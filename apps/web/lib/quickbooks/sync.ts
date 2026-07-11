import type { createAdminClient } from '@/lib/supabase/server'
import { escapeQboQueryValue, getValidConnection, qboFetch, type QuickBooksConnection } from './server'

// ── Sincronizacion con QuickBooks Online ───────────────────────────────────────
// Dos flujos: (1) un Sales Receipt por reserva completada, (2) una Invoice de
// QBO espejo de cada invoice corporativa que ya genera
// app/api/cron/corporate-invoices/route.ts. Ambos comparten cliente + item de
// servicio (se crean una sola vez por empresa y se cachean en
// companies.quickbooks_item_id).

const SERVICE_ITEM_NAME = 'LuxeRide Transportation Service'

interface QboQueryResponse<T> {
  QueryResponse?: Record<string, T[]>
}

async function queryFirst<T>(connection: QuickBooksConnection, entity: string, where: string): Promise<T | null> {
  const query = `SELECT * FROM ${entity} WHERE ${where}`
  const json = (await qboFetch(connection, `query?query=${encodeURIComponent(query)}`)) as QboQueryResponse<T>
  const rows = json.QueryResponse?.[entity]
  return rows?.[0] ?? null
}

/**
 * Normaliza un nombre de pasajero/cliente para usarlo como clave de match:
 * colapsa espacios repetidos y pasa a minusculas. Evita que "Steephany
 * Vargas" y "steephany   vargas" (misma persona, distinta captura) se traten
 * como clientes distintos en QuickBooks. NO corrige errores de tipeo reales
 * (ej. "Stephany" vs "Steephany" con una letra de mas/menos siguen siendo
 * nombres distintos) — es normalizacion de formato, no fuzzy-matching.
 */
export function normalizeCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Busca (por nombre normalizado) o crea un Customer en QBO. Devuelve su Id.
 * Guarda el mapeo en `quickbooks_customers` (por empresa) para no depender de
 * una busqueda exacta en QBO en cada sincronizacion, y para que variantes de
 * capitalizacion/espacios del mismo nombre resuelvan al mismo cliente.
 */
async function findOrCreateCustomer(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  connection: QuickBooksConnection,
  displayName: string,
): Promise<string> {
  const safeName = displayName.slice(0, 100).trim() || 'Pasajero LuxeRide'
  const normalized = normalizeCustomerName(safeName)

  const { data: cached } = await admin
    .from('quickbooks_customers')
    .select('quickbooks_customer_id')
    .eq('company_id', companyId)
    .eq('normalized_name', normalized)
    .maybeSingle()
  if (cached) return cached.quickbooks_customer_id

  // Sin cache local todavia (ej. cliente creado antes de que existiera esta
  // tabla) — se intenta el match exacto en QBO antes de crear uno nuevo, para
  // no duplicar innecesariamente.
  const existing = await queryFirst<{ Id: string }>(
    connection,
    'Customer',
    `DisplayName = '${escapeQboQueryValue(safeName)}'`,
  )
  const customerId =
    existing?.Id ??
    (
      (await qboFetch(connection, 'customer', {
        method: 'POST',
        body: JSON.stringify({ DisplayName: safeName }),
      })) as { Customer: { Id: string } }
    ).Customer.Id

  await admin.from('quickbooks_customers').insert({
    company_id: companyId,
    normalized_name: normalized,
    display_name: safeName,
    quickbooks_customer_id: customerId,
  })

  return customerId
}

/**
 * Busca (o crea, una sola vez) el Item de servicio que representa un viaje de
 * LuxeRide, y cachea su Id en companies.quickbooks_item_id para no repetir la
 * busqueda/creacion en cada sincronizacion.
 */
async function getOrCreateServiceItemId(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  connection: QuickBooksConnection,
): Promise<string> {
  const { data: company } = await admin
    .from('companies')
    .select('quickbooks_item_id')
    .eq('id', companyId)
    .single()
  if (company?.quickbooks_item_id) return company.quickbooks_item_id

  const existingItem = await queryFirst<{ Id: string }>(
    connection,
    'Item',
    `Name = '${escapeQboQueryValue(SERVICE_ITEM_NAME)}'`,
  )
  if (existingItem) {
    await admin.from('companies').update({ quickbooks_item_id: existingItem.Id }).eq('id', companyId)
    return existingItem.Id
  }

  // Un Item de tipo Service necesita una cuenta de ingresos existente — se
  // usa la primera cuenta de tipo Income del Chart of Accounts de la empresa
  // (toda cuenta QBO nueva trae al menos una por defecto).
  const incomeAccount = await queryFirst<{ Id: string }>(connection, 'Account', "AccountType = 'Income'")
  if (!incomeAccount) throw new Error('QuickBooks: no se encontro una cuenta de ingresos para crear el item de servicio')

  const created = (await qboFetch(connection, 'item', {
    method: 'POST',
    body: JSON.stringify({
      Name: SERVICE_ITEM_NAME,
      Type: 'Service',
      IncomeAccountRef: { value: incomeAccount.Id },
    }),
  })) as { Item: { Id: string } }

  await admin.from('companies').update({ quickbooks_item_id: created.Item.Id }).eq('id', companyId)
  return created.Item.Id
}

export interface BookingSyncResult {
  synced: number
  failed: number
}

/**
 * Crea un Sales Receipt en QuickBooks por cada reserva `completed` de la
 * empresa que todavia no se sincronizo. No lanza — cada reserva que falla se
 * salta (queda para el proximo intento) sin abortar el resto del lote.
 */
export async function syncCompletedBookingsForCompany(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<BookingSyncResult> {
  const connection = await getValidConnection(admin, companyId)
  if (!connection) return { synced: 0, failed: 0 }

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, booking_number, passenger_name, passenger_email, total_amount, currency, completed_at, scheduled_at')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .is('quickbooks_synced_at', null)
    .gt('total_amount', 0)
    .order('completed_at', { ascending: true })
    .limit(200)

  let synced = 0
  let failed = 0

  for (const booking of bookings ?? []) {
    try {
      const itemId = await getOrCreateServiceItemId(admin, companyId, connection)
      const customerId = await findOrCreateCustomer(
        admin,
        companyId,
        connection,
        booking.passenger_name ?? booking.passenger_email ?? `Reserva ${booking.booking_number}`,
      )

      const receipt = (await qboFetch(connection, 'salesreceipt', {
        method: 'POST',
        body: JSON.stringify({
          CustomerRef: { value: customerId },
          TxnDate: (booking.completed_at ?? booking.scheduled_at).slice(0, 10),
          Line: [
            {
              DetailType: 'SalesItemLineDetail',
              Amount: Number(booking.total_amount ?? 0),
              Description: `Viaje ${booking.booking_number}`,
              SalesItemLineDetail: { ItemRef: { value: itemId } },
            },
          ],
        }),
      })) as { SalesReceipt: { Id: string } }

      await admin
        .from('bookings')
        .update({
          quickbooks_synced_at: new Date().toISOString(),
          quickbooks_sales_receipt_id: receipt.SalesReceipt.Id,
        })
        .eq('id', booking.id)
      synced++
    } catch (err) {
      console.error(`[quickbooks/sync] booking ${booking.id}`, err)
      failed++
    }
  }

  if (synced > 0) {
    await admin.from('companies').update({ quickbooks_last_synced_at: new Date().toISOString() }).eq('id', companyId)
  }

  return { synced, failed }
}

/**
 * Crea la Invoice espejo en QuickBooks de una invoice corporativa ya generada
 * en LuxeRide (invoices + invoice_line_items). Se llama tanto desde el cron de
 * facturacion corporativa como desde la sincronizacion manual.
 */
export async function syncInvoiceToQuickBooks(
  admin: ReturnType<typeof createAdminClient>,
  opts: { companyId: string; invoiceId: string; customerName: string },
): Promise<boolean> {
  const connection = await getValidConnection(admin, opts.companyId)
  if (!connection) return false

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, invoice_number, due_date, quickbooks_synced_at')
    .eq('id', opts.invoiceId)
    .single()
  if (!invoice || invoice.quickbooks_synced_at) return false

  const { data: lineItems } = await admin
    .from('invoice_line_items')
    .select('description, quantity, unit_price, total_price')
    .eq('invoice_id', opts.invoiceId)

  try {
    const itemId = await getOrCreateServiceItemId(admin, opts.companyId, connection)
    const customerId = await findOrCreateCustomer(admin, opts.companyId, connection, opts.customerName)

    const created = (await qboFetch(connection, 'invoice', {
      method: 'POST',
      body: JSON.stringify({
        CustomerRef: { value: customerId },
        DueDate: invoice.due_date ?? undefined,
        DocNumber: invoice.invoice_number,
        Line: (lineItems ?? []).map((li) => ({
          DetailType: 'SalesItemLineDetail',
          Amount: Number(li.total_price ?? 0),
          Description: li.description,
          SalesItemLineDetail: {
            ItemRef: { value: itemId },
            Qty: li.quantity ?? 1,
            UnitPrice: Number(li.unit_price ?? 0),
          },
        })),
      }),
    })) as { Invoice: { Id: string } }

    await admin
      .from('invoices')
      .update({ quickbooks_invoice_id: created.Invoice.Id, quickbooks_synced_at: new Date().toISOString() })
      .eq('id', opts.invoiceId)
    await admin
      .from('companies')
      .update({ quickbooks_last_synced_at: new Date().toISOString() })
      .eq('id', opts.companyId)
    return true
  } catch (err) {
    console.error(`[quickbooks/sync] invoice ${opts.invoiceId}`, err)
    return false
  }
}

/**
 * Reintenta las invoices corporativas de la empresa que quedaron sin
 * sincronizar (ej. QuickBooks estaba caido cuando el cron mensual de
 * facturacion corporativa intento el sync inicial). Llamado desde el cron
 * diario de quickbooks-sync — asi una invoice no queda huerfana hasta el
 * proximo primero de mes.
 */
export async function syncPendingInvoicesForCompany(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<BookingSyncResult> {
  const { data: pending } = await admin
    .from('invoices')
    .select('id, corporate_account_id')
    .eq('company_id', companyId)
    .is('quickbooks_synced_at', null)
    .not('corporate_account_id', 'is', null)
    .limit(50)

  let synced = 0
  let failed = 0

  for (const invoice of pending ?? []) {
    if (!invoice.corporate_account_id) continue
    const { data: account } = await admin
      .from('corporate_accounts')
      .select('name')
      .eq('id', invoice.corporate_account_id)
      .single()
    if (!account) continue

    const ok = await syncInvoiceToQuickBooks(admin, {
      companyId,
      invoiceId: invoice.id,
      customerName: account.name,
    })
    if (ok) synced++
    else failed++
  }

  return { synced, failed }
}
