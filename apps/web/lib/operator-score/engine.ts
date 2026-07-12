// ── LuxeRide Operator Score — lógica pura (sin DB) ─────────────────────────────
// Mismo espíritu que lib/compliance/engine.ts / lib/affiliates/engine.ts:
// funciones puras y testeables, el glue con Supabase vive en el server
// component de la página. Cada área devuelve 0-100 o `null` cuando no hay
// datos suficientes (nunca penaliza a un operador chico por no tener
// actividad en un área — ej. sin red de afiliados, sin cuentas corporativas).
//
// FASE 1 (2026-07-11): solo los números — sin párrafo de recomendación en
// lenguaje natural todavía (eso depende de OPENAI_API_KEY, pendiente a
// propósito hasta el primer cliente del asistente de IA). Ver docs/PENDING.md.

export type OperatorScoreArea =
  | 'complianceReadiness'
  | 'affiliateReliability'
  | 'chauffeurQuality'
  | 'dispatchEfficiency'
  | 'customerExperience'
  | 'revenueHealth'
  | 'growthPerformance'
  | 'corporateAccountStrength'

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function average(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v))
  if (!finite.length) return null
  return finite.reduce((a, b) => a + b, 0) / finite.length
}

/** Ya viene 0-100 (companies.compliance_score, ver lib/compliance/engine.ts). */
export function scoreComplianceReadiness(complianceScore: number | null): number | null {
  if (complianceScore == null) return null
  return clamp100(complianceScore)
}

/** Promedio de tasa de respuesta y puntualidad como afiliado (recibiendo viajes de otros). */
export function scoreAffiliateReliability(stats: {
  responseRatePct: number | null
  punctualityPct: number | null
}): number | null {
  const avg = average([stats.responseRatePct, stats.punctualityPct].filter((v): v is number => v != null))
  return avg == null ? null : clamp100(avg)
}

/** Promedio de puntualidad, (100 - cancelación/no-show) y calificación normalizada (1-5 → 0-100). */
export function scoreChauffeurQuality(stats: {
  punctualityPct: number | null
  cancellationPct: number | null
  avgRating: number | null // 1-5
}): number | null {
  const parts: number[] = []
  if (stats.punctualityPct != null) parts.push(stats.punctualityPct)
  if (stats.cancellationPct != null) parts.push(100 - stats.cancellationPct)
  if (stats.avgRating != null) parts.push(((stats.avgRating - 1) / 4) * 100)
  const avg = average(parts)
  return avg == null ? null : clamp100(avg)
}

/** % de reservas despachadas (asignadas) dentro de la ventana rápida. */
export function scoreDispatchEfficiency(stats: { dispatchedCount: number; fastDispatchCount: number }): number | null {
  if (stats.dispatchedCount <= 0) return null
  return clamp100((stats.fastDispatchCount / stats.dispatchedCount) * 100)
}

/** Calificación promedio del pasajero (1-5 → 0-100). */
export function scoreCustomerExperience(avgRating: number | null): number | null {
  if (avgRating == null) return null
  return clamp100(((avgRating - 1) / 4) * 100)
}

/**
 * Tendencia de ingresos vs. el periodo anterior. 0% de cambio = 70 (neutral,
 * ni premia ni castiga estar estable). Se limita el efecto a ±30 puntos para
 * que una racha corta no dispare el score a los extremos.
 */
export function scoreRevenueHealth(stats: { currentPeriodRevenue: number; priorPeriodRevenue: number }): number | null {
  if (stats.priorPeriodRevenue <= 0) {
    // Sin base de comparación real (operador nuevo o sin actividad previa).
    return stats.currentPeriodRevenue > 0 ? 70 : null
  }
  const trendPct = ((stats.currentPeriodRevenue - stats.priorPeriodRevenue) / stats.priorPeriodRevenue) * 100
  const clampedTrend = Math.max(-30, Math.min(30, trendPct))
  return clamp100(70 + clampedTrend)
}

/** Conversión de cotización a reserva en el periodo — la única área sin dato previo en el sistema. */
export function scoreGrowthPerformance(stats: { quotesCount: number; bookingsCount: number }): number | null {
  if (stats.quotesCount <= 0) return null
  return clamp100((stats.bookingsCount / stats.quotesCount) * 100)
}

/** % de facturas de cuentas corporativas al día (no vencidas). Neutral si no hay cuentas corporativas. */
export function scoreCorporateAccountStrength(stats: { totalInvoices: number; overdueInvoices: number }): number | null {
  if (stats.totalInvoices <= 0) return null
  return clamp100(((stats.totalInvoices - stats.overdueInvoices) / stats.totalInvoices) * 100)
}

export interface OperatorScoreResult {
  overall: number | null
  areas: Record<OperatorScoreArea, number | null>
}

/** Promedia las áreas que sí tienen datos — nunca penaliza un área sin actividad. */
export function computeOperatorScore(areas: Record<OperatorScoreArea, number | null>): OperatorScoreResult {
  const values = Object.values(areas).filter((v): v is number => v != null)
  const overall = values.length ? clamp100(values.reduce((a, b) => a + b, 0) / values.length) : null
  return { overall, areas }
}
