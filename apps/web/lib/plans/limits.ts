// ── Sección K — Límites de uso por plan (vehículos, choferes, reservas/mes,
// miembros de equipo) + fee por viaje. NULL en plan_quotas = sin límite.
// Bloqueo duro: al llegar al tope, la creación falla con un mensaje claro que
// apunta a subir de plan (decisión del usuario — no degradación silenciosa
// como el tracking en vivo).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, CompanyPlan, UserRole } from '@/lib/supabase/database.types'

type AdminClient = SupabaseClient<Database>

export interface PlanLimits {
  maxVehicles: number | null
  maxDrivers: number | null
  maxBookingsPerMonth: number | null
  maxTeamMembers: number | null
  platformFeePct: number
}

const FALLBACK_LIMITS: PlanLimits = {
  maxVehicles: null,
  maxDrivers: null,
  maxBookingsPerMonth: null,
  maxTeamMembers: null,
  platformFeePct: 0,
}

export async function getPlanLimits(admin: AdminClient, plan: CompanyPlan): Promise<PlanLimits> {
  const { data } = await admin
    .from('plan_quotas')
    .select('max_vehicles, max_drivers, max_bookings_per_month, max_team_members, platform_fee_pct')
    .eq('plan', plan)
    .single()

  if (!data) return FALLBACK_LIMITS

  return {
    maxVehicles: data.max_vehicles,
    maxDrivers: data.max_drivers,
    maxBookingsPerMonth: data.max_bookings_per_month,
    maxTeamMembers: data.max_team_members,
    platformFeePct: data.platform_fee_pct,
  }
}

async function getCompanyPlan(admin: AdminClient, companyId: string): Promise<CompanyPlan> {
  const { data } = await admin.from('companies').select('plan').eq('id', companyId).single()
  return (data?.plan as CompanyPlan | null) ?? 'free'
}

export type LimitCheck = { ok: true } | { ok: false; error: string }

const UPGRADE_HINT = 'Actualiza tu plan en Configuración → Suscripción para ampliar este límite.'

export async function checkVehicleLimit(admin: AdminClient, companyId: string): Promise<LimitCheck> {
  const plan = await getCompanyPlan(admin, companyId)
  const { maxVehicles } = await getPlanLimits(admin, plan)
  if (maxVehicles === null) return { ok: true }

  const { count } = await admin
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if ((count ?? 0) >= maxVehicles) {
    return { ok: false, error: `Llegaste al límite de ${maxVehicles} vehículos de tu plan. ${UPGRADE_HINT}` }
  }
  return { ok: true }
}

// Para importaciones masivas: verifica que quepan `additional` vehículos más,
// no solo que haya espacio para 1.
export async function checkVehicleLimitBulk(
  admin: AdminClient,
  companyId: string,
  additional: number,
): Promise<LimitCheck> {
  const plan = await getCompanyPlan(admin, companyId)
  const { maxVehicles } = await getPlanLimits(admin, plan)
  if (maxVehicles === null) return { ok: true }

  const { count } = await admin
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if ((count ?? 0) + additional > maxVehicles) {
    const remaining = Math.max(0, maxVehicles - (count ?? 0))
    return {
      ok: false,
      error: `Tu plan permite hasta ${maxVehicles} vehículos (te quedan ${remaining} disponibles) | esta importación agregaría ${additional}. ${UPGRADE_HINT}`,
    }
  }
  return { ok: true }
}

export async function checkDriverLimit(admin: AdminClient, companyId: string): Promise<LimitCheck> {
  const plan = await getCompanyPlan(admin, companyId)
  const { maxDrivers } = await getPlanLimits(admin, plan)
  if (maxDrivers === null) return { ok: true }

  const { count } = await admin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role', 'driver')

  if ((count ?? 0) >= maxDrivers) {
    return { ok: false, error: `Llegaste al límite de ${maxDrivers} choferes de tu plan. ${UPGRADE_HINT}` }
  }
  return { ok: true }
}

// "Miembros de equipo" = roles administrativos (no choferes, no clientes).
const TEAM_ROLES: UserRole[] = ['company_owner', 'company_admin', 'dispatcher', 'accounting']

export async function checkTeamMemberLimit(admin: AdminClient, companyId: string): Promise<LimitCheck> {
  const plan = await getCompanyPlan(admin, companyId)
  const { maxTeamMembers } = await getPlanLimits(admin, plan)
  if (maxTeamMembers === null) return { ok: true }

  const { count } = await admin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .in('role', TEAM_ROLES)

  if ((count ?? 0) >= maxTeamMembers) {
    return { ok: false, error: `Llegaste al límite de ${maxTeamMembers} miembros de equipo de tu plan. ${UPGRADE_HINT}` }
  }
  return { ok: true }
}

export async function checkMonthlyBookingLimit(admin: AdminClient, companyId: string): Promise<LimitCheck> {
  const plan = await getCompanyPlan(admin, companyId)
  const { maxBookingsPerMonth } = await getPlanLimits(admin, plan)
  if (maxBookingsPerMonth === null) return { ok: true }

  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const { count } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', startOfMonth)

  if ((count ?? 0) >= maxBookingsPerMonth) {
    return {
      ok: false,
      error: `Llegaste al límite de ${maxBookingsPerMonth} reservas este mes en tu plan. ${UPGRADE_HINT}`,
    }
  }
  return { ok: true }
}
