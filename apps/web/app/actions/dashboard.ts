'use server'
// ── Tendencia de reservas del panel — rangos seleccionables ────────────────
// El panel (app/admin/dashboard/page.tsx) renderiza el rango "esta semana"
// del lado del servidor (sin round-trip extra al cargar); esta acción cubre
// el resto de rangos que el usuario puede elegir desde los pills del cliente
// (components/admin/dashboard/bookings-trend-chart.tsx).

import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LOCALE_BCP47 } from '@/lib/i18n/config'

export type TrendRange = 'this_week' | 'last_week' | 'last_30' | 'last_90'

export interface TrendPoint {
  label: string
  count: number
}

type ActionResult<T> = { success: boolean; error?: string; data?: T }

export async function getBookingsTrendAction(range: TrendRange): Promise<ActionResult<TrendPoint[]>> {
  const user = await requireRole('super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const locale = getLocale()
  const dayLabels = getDict(locale).adminDashboard.dayLabels
  const localeTag = LOCALE_BCP47[locale]

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let rangeStart: Date
  let bucketDays: number
  const isWeekly = range === 'this_week' || range === 'last_week'

  if (isWeekly) {
    // Semana con inicio en DOMINGO (getDay(): 0=Dom … 6=Sáb), mismo criterio
    // que el resto del panel (facturación, reportes).
    const weekStart = new Date(todayStart)
    weekStart.setDate(todayStart.getDate() - todayStart.getDay())
    if (range === 'last_week') weekStart.setDate(weekStart.getDate() - 7)
    rangeStart = weekStart
    bucketDays = 7
  } else {
    bucketDays = range === 'last_30' ? 30 : 90
    rangeStart = new Date(todayStart.getTime() - (bucketDays - 1) * 86_400_000)
  }
  const rangeEnd = new Date(rangeStart.getTime() + bucketDays * 86_400_000)

  const { data: rows } = await admin
    .from('bookings')
    .select('created_at')
    .eq('company_id', user.company_id)
    .gte('created_at', rangeStart.toISOString())
    .lt('created_at', rangeEnd.toISOString())

  const points: TrendPoint[] = Array.from({ length: bucketDays }, (_, i) => {
    const dayStart = new Date(rangeStart.getTime() + i * 86_400_000)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const count = (rows ?? []).filter((b) => {
      const created = new Date(b.created_at)
      return created >= dayStart && created < dayEnd
    }).length
    const label = isWeekly
      ? dayLabels[dayStart.getDay()]
      : dayStart.toLocaleDateString(localeTag, { day: 'numeric', month: 'short' })
    return { label, count }
  })

  return { success: true, data: points }
}
