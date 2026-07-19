// ── Cuota de consultas de seguimiento de vuelos por plan ───────────────────────
// La API externa (AeroDataBox/FlightAware) es una cuenta ÚNICA compartida por
// TODA la plataforma -- protege ese cupo compartido de que una sola empresa
// con mucho volumen se lo agote a las demás. Mismo patrón que
// lib/tracking/live-tracking-quota.ts (mapa en vivo): al pasarse la cuota,
// esa empresa simplemente deja de recibir estado de vuelo por el resto del
// mes -- degradación amable, nunca bloqueo duro.

import { createAdminClient } from '@/lib/supabase/server'
import type { CompanyPlan } from '@/lib/supabase/database.types'
import { currentYearMonth } from '@/lib/tracking/live-tracking-quota'

// Devuelve true si la empresa puede consumir UNA consulta de vuelo más este
// mes (y lo registra); false si ya alcanzó su cuota (el llamador debe omitir
// la consulta a la API externa en ese caso).
export async function consumeFlightTrackingQuota(companyId: string): Promise<boolean> {
  const admin = createAdminClient()
  const yearMonth = currentYearMonth()

  const { data: company } = await admin.from('companies').select('plan').eq('id', companyId).single()
  const plan = (company?.plan as CompanyPlan | null) ?? 'free'

  const { data: quotaRow } = await admin
    .from('plan_quotas')
    .select('flight_tracking_monthly_quota')
    .eq('plan', plan)
    .single()
  const quota = quotaRow?.flight_tracking_monthly_quota ?? null // NULL = sin límite

  const { data: usage } = await admin
    .from('flight_tracking_usage')
    .select('lookup_count')
    .eq('company_id', companyId)
    .eq('year_month', yearMonth)
    .maybeSingle()
  const current = usage?.lookup_count ?? 0

  if (quota !== null && current >= quota) return false

  if (usage) {
    await admin
      .from('flight_tracking_usage')
      .update({ lookup_count: current + 1 })
      .eq('company_id', companyId)
      .eq('year_month', yearMonth)
  } else {
    await admin.from('flight_tracking_usage').insert({ company_id: companyId, year_month: yearMonth, lookup_count: 1 })
  }

  return true
}
