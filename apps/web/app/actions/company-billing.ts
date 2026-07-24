'use server'
// ── Cargos adicionales recurrentes — LuxeRide cobra al OPERADOR ────────────
// Caso de uso original: hosting de dominio personalizado comprado por
// LuxeRide (ver app/actions/domains.ts) cuyo costo real varía según
// disponibilidad — no tiene precio fijo, así que se gestiona como un cargo
// manual por empresa en vez de un plan de Whop con precio único. Genérico
// desde el inicio: sirve para cualquier cargo especial futuro, no solo dominio.
//
// El operador guarda UNA vez una tarjeta con la cuenta PADRE de Whop de
// LuxeRide (createCompanyBillingSetupCheckout, ver lib/whop/checkout.ts) —
// autorización única, igual que una suscripción normal. Un cron diario
// (app/api/cron/company-extra-charges) cobra los cargos vencidos contra esa
// tarjeta. Cada cobro individual queda en company_extra_charge_payments para
// poder reversar (acreditar) UNO puntual sin afectar los demás — ej. si por
// error se cobró dos veces, se reversa solo uno.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { createCompanyBillingSetupCheckout } from '@/lib/whop/checkout'
import { getWhopClient } from '@/lib/whop/connect-server'
import { getAppUrl } from '@/lib/app-url'
import type { ExtraChargePaymentStatus } from '@/lib/supabase/database.types'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

export interface ExtraChargeRow {
  id: string
  label: string
  amountCents: number
  currency: string
  frequencyMonths: number
  nextChargeDate: string
  active: boolean
}

export interface ExtraChargePaymentRow {
  id: string
  extraChargeId: string
  amountCents: number
  currency: string
  status: ExtraChargePaymentStatus
  failureMessage: string | null
  chargedAt: string
  refundedAt: string | null
  refundReason: string | null
}

function mapCharge(row: {
  id: string; label: string; amount_cents: number; currency: string
  frequency_months: number; next_charge_date: string; active: boolean
}): ExtraChargeRow {
  return {
    id: row.id,
    label: row.label,
    amountCents: row.amount_cents,
    currency: row.currency,
    frequencyMonths: row.frequency_months,
    nextChargeDate: row.next_charge_date,
    active: row.active,
  }
}

function mapPayment(row: {
  id: string; extra_charge_id: string; amount_cents: number; currency: string
  status: ExtraChargePaymentStatus; failure_message: string | null
  charged_at: string; refunded_at: string | null; refund_reason: string | null
}): ExtraChargePaymentRow {
  return {
    id: row.id,
    extraChargeId: row.extra_charge_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    failureMessage: row.failure_message,
    chargedAt: row.charged_at,
    refundedAt: row.refunded_at,
    refundReason: row.refund_reason,
  }
}

// ─── Operador (solo lectura + guardar tarjeta) ─────────────────────────────

export async function getCompanyBillingStatusAction(): Promise<
  ActionResult<{ cardSaved: boolean; extraCharges: ExtraChargeRow[] }>
> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const [{ data: company }, { data: charges }] = await Promise.all([
    admin.from('companies').select('whop_billing_member_id').eq('id', user.company_id).single(),
    admin
      .from('company_extra_charges')
      .select('id, label, amount_cents, currency, frequency_months, next_charge_date, active')
      .eq('company_id', user.company_id)
      .eq('active', true)
      .order('created_at', { ascending: false }),
  ])

  return {
    success: true,
    data: {
      cardSaved: Boolean(company?.whop_billing_member_id),
      extraCharges: (charges ?? []).map(mapCharge),
    },
  }
}

export async function createBillingCardSetupCheckoutAction(): Promise<ActionResult<{ url: string }>> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const result = await createCompanyBillingSetupCheckout({
    companyId: user.company_id,
    redirectUrl: `${getAppUrl()}/admin/settings`,
  })
  if (!result.ok) return { success: false, error: 'No se pudo iniciar el guardado de tarjeta' }
  return { success: true, data: { url: result.url } }
}

// ─── Super-admin ────────────────────────────────────────────────────────────

export async function listCompanyExtraChargesAction(companyId: string): Promise<ExtraChargeRow[]> {
  await requireRole('super_admin')
  const admin = createAdminClient()
  const { data } = await admin
    .from('company_extra_charges')
    .select('id, label, amount_cents, currency, frequency_months, next_charge_date, active')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  return (data ?? []).map(mapCharge)
}

export async function listCompanyExtraChargePaymentsAction(companyId: string): Promise<ExtraChargePaymentRow[]> {
  await requireRole('super_admin')
  const admin = createAdminClient()
  const { data } = await admin
    .from('company_extra_charge_payments')
    .select('id, extra_charge_id, amount_cents, currency, status, failure_message, charged_at, refunded_at, refund_reason')
    .eq('company_id', companyId)
    .order('charged_at', { ascending: false })
    .limit(50)
  return (data ?? []).map(mapPayment)
}

export async function createCompanyExtraChargeAction(
  companyId: string,
  label: string,
  amountDollars: number,
  frequencyMonths: 1 | 12,
  startDate: string,
): Promise<ActionResult> {
  const user = await requireRole('super_admin')

  const cleanLabel = label.trim()
  if (!cleanLabel) return { success: false, error: 'Escribe una etiqueta para el cargo' }
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) return { success: false, error: 'Monto inválido' }
  if (!startDate) return { success: false, error: 'Falta la fecha del primer cobro' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_extra_charges').insert({
    company_id: companyId,
    label: cleanLabel,
    amount_cents: Math.round(amountDollars * 100),
    frequency_months: frequencyMonths,
    next_charge_date: startDate,
    created_by: user.id,
  })
  if (error) {
    console.error('[createCompanyExtraChargeAction]', error)
    return { success: false, error: 'No se pudo crear el cargo' }
  }

  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}

export async function toggleCompanyExtraChargeActiveAction(
  chargeId: string,
  companyId: string,
  active: boolean,
): Promise<ActionResult> {
  await requireRole('super_admin')
  const admin = createAdminClient()
  const { error } = await admin.from('company_extra_charges').update({ active }).eq('id', chargeId)
  if (error) return { success: false, error: 'Error al actualizar el cargo' }
  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}

export async function deleteCompanyExtraChargeAction(chargeId: string, companyId: string): Promise<ActionResult> {
  await requireRole('super_admin')
  const admin = createAdminClient()
  const { error } = await admin.from('company_extra_charges').delete().eq('id', chargeId)
  if (error) return { success: false, error: 'Error al eliminar el cargo' }
  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}

/** Reversa (acredita) UN cobro puntual ya exitoso — ej. cobro duplicado por error. */
export async function reverseCompanyExtraChargePaymentAction(
  paymentId: string,
  companyId: string,
  reason?: string,
): Promise<ActionResult> {
  const user = await requireRole('super_admin')

  const admin = createAdminClient()
  const { data: payment } = await admin
    .from('company_extra_charge_payments')
    .select('id, status, whop_payment_id')
    .eq('id', paymentId)
    .eq('company_id', companyId)
    .single()
  if (!payment) return { success: false, error: 'Cobro no encontrado' }
  if (payment.status !== 'succeeded') return { success: false, error: 'Solo se pueden reversar cobros exitosos' }
  if (!payment.whop_payment_id) return { success: false, error: 'Este cobro no tiene un pago de Whop registrado todavía' }

  const whop = getWhopClient()
  if (!whop) return { success: false, error: 'Whop no está configurado' }

  try {
    await whop.payments.refund(payment.whop_payment_id, {})
    await admin
      .from('company_extra_charge_payments')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        refunded_by: user.id,
        refund_reason: reason?.trim() || null,
      })
      .eq('id', paymentId)

    revalidatePath(`/super-admin/companies/${companyId}`)
    return { success: true }
  } catch (err) {
    console.error('[reverseCompanyExtraChargePaymentAction]', err)
    return { success: false, error: 'Error al reversar el cobro con Whop' }
  }
}
