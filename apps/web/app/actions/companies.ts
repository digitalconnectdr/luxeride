'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { activateCompanySubscription } from '@/lib/billing/subscriptions'
import { getPlanLimits } from '@/lib/plans/limits'
import type { CompanyStatus, CompanyPlan } from '@/lib/supabase/database.types'

export type CompanyActionResult = {
  success: boolean
  error?: string
}

export async function updateCompanyStatus(
  companyId: string,
  status: CompanyStatus
): Promise<CompanyActionResult> {
  // Throws redirect if caller isn't super_admin
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .update({ status })
    .eq('id', companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/companies')
  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}

export async function updateCompanyPlan(
  companyId: string,
  plan: CompanyPlan
): Promise<CompanyActionResult> {
  await requireRole('super_admin')

  const admin = createAdminClient()

  // Sección K: al cambiar de plan, el fee por viaje vuelve al default del
  // plan nuevo (el super-admin puede volver a sobreescribirlo después desde
  // updateCompanyCommissionAction si el caso lo amerita).
  const { data: current } = await admin.from('companies').select('settings').eq('id', companyId).single()
  const settings = (current?.settings as Record<string, unknown> | null) ?? {}
  const payments = (settings.payments as Record<string, unknown> | undefined) ?? {}
  const { platformFeePct } = await getPlanLimits(admin, plan)

  const { error } = await admin
    .from('companies')
    .update({ plan, settings: { ...settings, payments: { ...payments, platform_fee_pct: platformFeePct } } })
    .eq('id', companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/companies')
  revalidatePath(`/super-admin/companies/${companyId}`)
  revalidatePath('/super-admin/subscriptions')
  return { success: true }
}

// ─── Comisión de la plataforma sobre cobros a pasajeros (Stripe/Whop Connect) ─
// Vive en companies.settings.payments.platform_fee_pct (mismo campo que ya
// leen app/actions/payments.ts y app/actions/trip.ts para calcular
// application_fee_amount) — sin migración nueva, solo la UI para editarlo.

export async function updateCompanyCommissionAction(
  companyId: string,
  pct: number,
): Promise<CompanyActionResult> {
  await requireRole('super_admin')

  if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
    return { success: false, error: 'La comisión debe estar entre 0% y 50%' }
  }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('settings')
    .eq('id', companyId)
    .single()

  const settings = (company?.settings as Record<string, unknown> | null) ?? {}
  const payments = (settings.payments as Record<string, unknown> | undefined) ?? {}

  const { error } = await admin
    .from('companies')
    .update({ settings: { ...settings, payments: { ...payments, platform_fee_pct: pct } } })
    .eq('id', companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}

// ─── Cuota de tracking en vivo por plan (protege el costo de Google Maps) ─────

export async function updatePlanQuotaAction(
  plan: CompanyPlan,
  quota: number | null,
): Promise<CompanyActionResult> {
  await requireRole('super_admin')

  const safeQuota = quota === null ? null : Math.max(0, Math.floor(quota))
  const admin = createAdminClient()
  const { error } = await admin
    .from('plan_quotas')
    .update({ live_tracking_monthly_quota: safeQuota })
    .eq('plan', plan)

  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/tracking')
  return { success: true }
}

// ─── Cuota de seguimiento de vuelos por plan (protege la cuenta compartida de
// la API externa -- AeroDataBox/FlightAware) ───────────────────────────────

export async function updateFlightTrackingQuotaAction(
  plan: CompanyPlan,
  quota: number | null,
): Promise<CompanyActionResult> {
  await requireRole('super_admin')

  const safeQuota = quota === null ? null : Math.max(0, Math.floor(quota))
  const admin = createAdminClient()
  const { error } = await admin
    .from('plan_quotas')
    .update({ flight_tracking_monthly_quota: safeQuota })
    .eq('plan', plan)

  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/tracking')
  return { success: true }
}

// ─── Precio mensual por plan (para calcular MRR real en el dashboard) ─────────

export async function updatePlanPriceAction(
  plan: CompanyPlan,
  price: number,
): Promise<CompanyActionResult> {
  await requireRole('super_admin')

  if (!Number.isFinite(price) || price < 0) {
    return { success: false, error: 'Precio inválido' }
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('plan_quotas')
    .update({ monthly_price: price })
    .eq('plan', plan)

  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/tracking')
  revalidatePath('/super-admin/dashboard')
  return { success: true }
}

// ─── Suscripciones (panel del owner de la plataforma) ─────────────────────────

/**
 * Renueva la suscripción de una empresa: extiende subscription_ends_at
 * `months` meses desde max(hoy, vencimiento actual) y la activa.
 */
export async function renewSubscriptionAction(
  companyId: string,
  months: number,
): Promise<CompanyActionResult> {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const result = await activateCompanySubscription(admin, companyId, months)
  if (!result.success) return result

  revalidatePath('/super-admin/subscriptions')
  revalidatePath('/super-admin/companies')
  return { success: true }
}

/**
 * Aprueba una solicitud pendiente (empresa en trial creada desde el landing):
 * la activa y le da su primer mes de suscripción.
 */
export async function approveCompanyAction(
  companyId: string,
): Promise<CompanyActionResult> {
  return renewSubscriptionAction(companyId, 1)
}

/** Rechaza/da de baja una solicitud: la marca como cancelada. */
export async function rejectCompanyAction(
  companyId: string,
): Promise<CompanyActionResult> {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .update({ status: 'cancelled' })
    .eq('id', companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/subscriptions')
  revalidatePath('/super-admin/companies')
  return { success: true }
}
