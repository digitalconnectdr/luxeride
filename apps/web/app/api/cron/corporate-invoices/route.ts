// ── Cron mensual: facturación de cuentas corporativas ─────────────────────────
// Agrupa los viajes completados a crédito (corporate_account_id) que aún no
// fueron facturados, genera la invoice con sus line items, actualiza el
// balance de la cuenta y envía el email de factura.
//
// Programado en vercel.json (día 1 de cada mes). Protegido con CRON_SECRET.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'
import { syncInvoiceToQuickBooks } from '@/lib/quickbooks/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sin secret configurado, el cron queda deshabilitado
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results: { account: string; invoiced: number; amount: number }[] = []

  const { data: accounts } = await admin
    .from('corporate_accounts')
    .select('id, company_id, name, billing_email, contact_email, payment_terms, current_balance')
    .eq('is_active', true)

  for (const account of accounts ?? []) {
    try {
      // Bookings ya facturados de esta cuenta
      const { data: invoices } = await admin
        .from('invoices')
        .select('id')
        .eq('corporate_account_id', account.id)

      let invoicedBookingIds = new Set<string>()
      if (invoices?.length) {
        const { data: items } = await admin
          .from('invoice_line_items')
          .select('booking_id')
          .in('invoice_id', invoices.map((i) => i.id))
        invoicedBookingIds = new Set(
          (items ?? []).map((i) => i.booking_id).filter(Boolean) as string[],
        )
      }

      // Viajes completados a crédito sin facturar
      const { data: bookings } = await admin
        .from('bookings')
        .select('id, booking_number, scheduled_at, total_amount, currency')
        .eq('corporate_account_id', account.id)
        .eq('status', 'completed')
        .order('scheduled_at')
        .limit(500)

      const pending = (bookings ?? []).filter(
        (b) => !invoicedBookingIds.has(b.id) && Number(b.total_amount ?? 0) > 0,
      )
      if (pending.length === 0) continue

      const subtotal = pending.reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + (account.payment_terms ?? 30))

      const { data: invoice, error: invErr } = await admin
        .from('invoices')
        .insert({
          company_id: account.company_id,
          corporate_account_id: account.id,
          invoice_number: '', // trigger set_invoice_number lo genera
          status: 'sent',
          subtotal,
          total_amount: subtotal,
          currency: pending[0]!.currency ?? 'USD',
          due_date: dueDate.toISOString().slice(0, 10),
          sent_at: new Date().toISOString(),
          notes: `Facturación automática | ${pending.length} viaje(s) completado(s)`,
        })
        .select('id, invoice_number')
        .single()

      if (invErr || !invoice) {
        console.error(`[cron/corporate-invoices] invoice insert for ${account.id}`, invErr)
        continue
      }

      await admin.from('invoice_line_items').insert(
        pending.map((b) => ({
          invoice_id: invoice.id,
          booking_id: b.id,
          description: `Viaje ${b.booking_number} | ${new Date(b.scheduled_at).toLocaleDateString('es-DO')}`,
          quantity: 1,
          unit_price: Number(b.total_amount ?? 0),
          total_price: Number(b.total_amount ?? 0),
        })),
      )

      // Balance pendiente de la cuenta
      await admin
        .from('corporate_accounts')
        .update({ current_balance: Number(account.current_balance ?? 0) + subtotal })
        .eq('id', account.id)

      // Espejo en QuickBooks (si la empresa lo tiene conectado y activado) —
      // no bloquea el resto del flujo si falla; el cron diario de
      // quickbooks-sync reintenta cualquier invoice con
      // quickbooks_synced_at IS NULL, asi que no queda huerfana hasta el
      // proximo mes.
      try {
        await syncInvoiceToQuickBooks(admin, {
          companyId: account.company_id,
          invoiceId: invoice.id,
          customerName: account.name,
        })
      } catch (err) {
        console.error(`[cron/corporate-invoices] quickbooks sync for invoice ${invoice.id}`, err)
      }

      // Email de factura
      const recipient = account.billing_email ?? account.contact_email
      if (recipient) {
        await notify({
          companyId: account.company_id,
          channel: 'email',
          type: 'corporate_invoice',
          recipient,
          vars: {
            invoice_number: invoice.invoice_number,
            total_amount: subtotal.toFixed(2),
            currency: pending[0]!.currency ?? 'USD',
            due_date: dueDate.toLocaleDateString('es-DO'),
          },
        })
      }

      results.push({ account: account.name, invoiced: pending.length, amount: subtotal })
    } catch (err) {
      console.error(`[cron/corporate-invoices] account ${account.id}`, err)
    }
  }

  return NextResponse.json({ ok: true, invoices: results })
}
