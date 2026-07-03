'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
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
  const { error } = await admin
    .from('companies')
    .update({ plan })
    .eq('id', companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/companies')
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

  const safeMonths = Math.min(24, Math.max(1, Math.floor(months) || 1))
  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('subscription_ends_at')
    .eq('id', companyId)
    .single()

  if (!company) return { success: false, error: 'Empresa no encontrada' }

  const current = company.subscription_ends_at
    ? new Date(company.subscription_ends_at)
    : null
  const base = current && current > new Date() ? current : new Date()
  const newEnd = new Date(base)
  newEnd.setMonth(newEnd.getMonth() + safeMonths)

  const { error } = await admin
    .from('companies')
    .update({
      subscription_ends_at: newEnd.toISOString(),
      status: 'active',
    })
    .eq('id', companyId)

  if (error) return { success: false, error: error.message }

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
