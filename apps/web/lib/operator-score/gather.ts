// ── LuxeRide Operator Score — glue de DB (no puro, a diferencia de engine.ts) ──
// Reune los datos crudos de cada una de las 8 areas y los deja listos para las
// funciones puras de ./engine.ts. Mismo espiritu que lib/compliance/recompute.ts.

import type { createAdminClient } from '@/lib/supabase/server'
import { computeAffiliateReliability } from '@/lib/affiliates/engine'

type Admin = ReturnType<typeof createAdminClient>

const FAST_DISPATCH_MINUTES = 15
const ARRIVAL_GRACE_MINUTES = 10

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export interface OperatorScoreInputs {
  complianceScore: number | null
  affiliateReliability: { responseRatePct: number | null; punctualityPct: number | null }
  chauffeurQuality: { punctualityPct: number | null; cancellationPct: number | null; avgRating: number | null }
  dispatchEfficiency: { dispatchedCount: number; fastDispatchCount: number }
  customerExperienceAvgRating: number | null
  revenue: { currentPeriodRevenue: number; priorPeriodRevenue: number }
  growth: { quotesCount: number; bookingsCount: number }
  corporateAccounts: { totalInvoices: number; overdueInvoices: number }
}

/** Ventana de análisis: últimos 30 días vs. los 30 anteriores a esos. */
export async function gatherOperatorScoreInputs(admin: Admin, companyId: string): Promise<OperatorScoreInputs> {
  const periodStart = daysAgo(30)
  const priorPeriodStart = daysAgo(60)

  const [
    { data: company },
    { data: affiliateTrips },
    { data: driverStatsBookings },
    { data: dispatchBookings },
    { data: currentRevenueBookings },
    { data: priorRevenueBookings },
    { count: quotesCount },
    { count: bookingsFromQuotesCount },
    { data: corporateInvoices },
  ] = await Promise.all([
    admin.from('companies').select('compliance_score').eq('id', companyId).single(),
    admin
      .from('affiliate_trips')
      .select('status, created_at, responded_at, preview_scheduled_at, arrived_at')
      .eq('affiliate_company_id', companyId)
      .gte('created_at', periodStart),
    admin
      .from('bookings')
      .select('status, scheduled_at, arrived_at, rating')
      .eq('company_id', companyId)
      .in('status', ['completed', 'cancelled', 'no_show'])
      .gte('created_at', periodStart),
    admin
      .from('bookings')
      .select('created_at, dispatched_at')
      .eq('company_id', companyId)
      .not('dispatched_at', 'is', null)
      .gte('created_at', periodStart),
    admin
      .from('bookings')
      .select('total_amount')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('completed_at', periodStart),
    admin
      .from('bookings')
      .select('total_amount')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('completed_at', priorPeriodStart)
      .lt('completed_at', periodStart),
    admin.from('price_quotes').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', periodStart),
    admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('price_quote_id', 'is', null)
      .gte('created_at', periodStart),
    admin.from('invoices').select('status').eq('company_id', companyId).not('corporate_account_id', 'is', null).in('status', ['sent', 'paid', 'overdue']),
  ])

  // Confiabilidad como afiliado (recibiendo viajes de otros operadores)
  const reliability = computeAffiliateReliability(
    (affiliateTrips ?? []).map((t) => ({
      status: t.status as never,
      createdAt: t.created_at,
      respondedAt: t.responded_at,
      previewScheduledAt: t.preview_scheduled_at,
      arrivedAt: t.arrived_at,
    })),
  )

  // Calidad de chofer: puntualidad + cancelación/no-show + rating promedio
  const completedForPunctuality = (driverStatsBookings ?? []).filter((b) => b.status === 'completed' && b.arrived_at)
  const onTime = completedForPunctuality.filter((b) => {
    const grace = new Date(b.scheduled_at).getTime() + ARRIVAL_GRACE_MINUTES * 60_000
    return new Date(b.arrived_at as string).getTime() <= grace
  })
  const punctualityPct = completedForPunctuality.length ? (onTime.length / completedForPunctuality.length) * 100 : null
  const problems = (driverStatsBookings ?? []).filter((b) => b.status === 'cancelled' || b.status === 'no_show')
  const cancellationPct = driverStatsBookings?.length ? (problems.length / driverStatsBookings.length) * 100 : null
  // Promedio real de calificaciones del PERIODO, tomado directo de bookings.rating
  // — NO de drivers.rating (esa columna nunca es NULL: el trigger que la
  // recalcula usa COALESCE(..., 5.00), así que un conductor sin ninguna
  // calificación real contaba como un 5/5 perfecto e inflaba este score).
  const driverRatings = (driverStatsBookings ?? [])
    .filter((b) => b.rating != null)
    .map((b) => Number(b.rating))
  const avgDriverRating = driverRatings.length ? driverRatings.reduce((a, b) => a + b, 0) / driverRatings.length : null

  // Eficiencia de dispatch: % despachado dentro de la ventana rápida
  const dispatched = dispatchBookings ?? []
  const fastDispatch = dispatched.filter(
    (b) => (new Date(b.dispatched_at as string).getTime() - new Date(b.created_at).getTime()) / 60_000 <= FAST_DISPATCH_MINUTES,
  )

  // Experiencia del pasajero: rating promedio de reservas completadas del periodo
  const { data: ratedBookings } = await admin
    .from('bookings')
    .select('rating')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .not('rating', 'is', null)
    .gte('completed_at', periodStart)
  const passengerRatings = (ratedBookings ?? []).map((b) => Number(b.rating)).filter((r) => Number.isFinite(r))
  const avgPassengerRating = passengerRatings.length ? passengerRatings.reduce((a, b) => a + b, 0) / passengerRatings.length : null

  const currentPeriodRevenue = (currentRevenueBookings ?? []).reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)
  const priorPeriodRevenue = (priorRevenueBookings ?? []).reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)

  const overdueInvoices = (corporateInvoices ?? []).filter((i) => i.status === 'overdue').length

  return {
    complianceScore: company?.compliance_score ?? null,
    affiliateReliability: { responseRatePct: reliability.responseRatePct, punctualityPct: reliability.punctualityPct },
    chauffeurQuality: { punctualityPct, cancellationPct, avgRating: avgDriverRating },
    dispatchEfficiency: { dispatchedCount: dispatched.length, fastDispatchCount: fastDispatch.length },
    customerExperienceAvgRating: avgPassengerRating,
    revenue: { currentPeriodRevenue, priorPeriodRevenue },
    growth: { quotesCount: quotesCount ?? 0, bookingsCount: bookingsFromQuotesCount ?? 0 },
    corporateAccounts: { totalInvoices: corporateInvoices?.length ?? 0, overdueInvoices },
  }
}
