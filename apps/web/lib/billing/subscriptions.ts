// ── Activación/renovación de la suscripción de una empresa a la plataforma ─────
// Lógica compartida entre la acción de super-admin (renewSubscriptionAction,
// requiere sesión) y el webhook de Whop (server-to-server, sin sesión — la
// autenticidad viene de la verificación de firma, no de un rol de usuario).

import type { createAdminClient } from '@/lib/supabase/server'
import type { CompanyPlan } from '@/lib/supabase/database.types'

export interface ActivateSubscriptionResult {
  success: boolean
  error?: string
}

/**
 * Extiende subscription_ends_at `months` meses desde max(hoy, vencimiento
 * actual) y marca la empresa como 'active'. Si se pasa `plan`, también lo
 * actualiza (nunca degrada el plan si no se especifica uno nuevo).
 */
export async function activateCompanySubscription(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  months: number,
  plan?: CompanyPlan,
): Promise<ActivateSubscriptionResult> {
  const safeMonths = Math.min(24, Math.max(1, Math.floor(months) || 1))

  const { data: company } = await admin
    .from('companies')
    .select('subscription_ends_at')
    .eq('id', companyId)
    .single()

  if (!company) return { success: false, error: 'Empresa no encontrada' }

  const current = company.subscription_ends_at ? new Date(company.subscription_ends_at) : null
  const base = current && current > new Date() ? current : new Date()
  const newEnd = new Date(base)
  newEnd.setMonth(newEnd.getMonth() + safeMonths)

  const updates: { subscription_ends_at: string; status: 'active'; plan?: CompanyPlan } = {
    subscription_ends_at: newEnd.toISOString(),
    status: 'active',
  }
  if (plan) updates.plan = plan

  const { error } = await admin.from('companies').update(updates).eq('id', companyId)
  if (error) return { success: false, error: error.message }

  return { success: true }
}
