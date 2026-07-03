// ── Cuota de refrescos de mapa en vivo por plan ────────────────────────────────
// Cada vez que se le pide a Google Static Maps una imagen NUEVA con la posición
// del conductor (no cada ping GPS — eso es gratis, es solo una escritura en
// Supabase) cuenta contra la cuota mensual del plan de la empresa. Al pasarse,
// esa empresa vuelve automáticamente al mapa estático simple (sin marcador en
// vivo) por el resto del mes — degradación amable, nunca bloqueo duro. Protege
// el margen del dueño de la plataforma sin importar cuánto crezca un operador.

import { createAdminClient } from '@/lib/supabase/server'
import type { CompanyPlan } from '@/lib/supabase/database.types'

export function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Devuelve true si la empresa puede consumir UN refresco más este mes (y lo
// registra); false si ya alcanzó su cuota (el llamador debe usar el mapa
// estático sin marcador en vivo en ese caso).
// `bookingId` (siempre lo pasa refreshLiveMapAction) también registra el
// consumo POR VIAJE — permite ver, en el detalle de una empresa, qué
// conductor/pasajero generó más carga de mapas en un viaje puntual.
export async function consumeLiveTrackingQuota(companyId: string, bookingId?: string): Promise<boolean> {
  const admin = createAdminClient()
  const yearMonth = currentYearMonth()

  const { data: company } = await admin.from('companies').select('plan').eq('id', companyId).single()
  const plan = (company?.plan as CompanyPlan | null) ?? 'free'

  const { data: quotaRow } = await admin
    .from('plan_quotas')
    .select('live_tracking_monthly_quota')
    .eq('plan', plan)
    .single()
  const quota = quotaRow?.live_tracking_monthly_quota ?? null // NULL = sin límite (Enterprise)

  const { data: usage } = await admin
    .from('live_tracking_usage')
    .select('refresh_count')
    .eq('company_id', companyId)
    .eq('year_month', yearMonth)
    .maybeSingle()
  const current = usage?.refresh_count ?? 0

  if (quota !== null && current >= quota) return false

  if (usage) {
    await admin
      .from('live_tracking_usage')
      .update({ refresh_count: current + 1 })
      .eq('company_id', companyId)
      .eq('year_month', yearMonth)
  } else {
    await admin.from('live_tracking_usage').insert({ company_id: companyId, year_month: yearMonth, refresh_count: 1 })
  }

  if (bookingId) {
    const { data: bookingUsage } = await admin
      .from('live_tracking_usage_by_booking')
      .select('refresh_count')
      .eq('booking_id', bookingId)
      .eq('year_month', yearMonth)
      .maybeSingle()
    if (bookingUsage) {
      await admin
        .from('live_tracking_usage_by_booking')
        .update({ refresh_count: bookingUsage.refresh_count + 1 })
        .eq('booking_id', bookingId)
        .eq('year_month', yearMonth)
    } else {
      await admin
        .from('live_tracking_usage_by_booking')
        .insert({ booking_id: bookingId, company_id: companyId, year_month: yearMonth, refresh_count: 1 })
    }
  }

  return true
}
