// ── Partner Portals — lógica pura (sin DB) ─────────────────────────────────────
// Mismo espíritu que lib/promo/engine.ts / lib/payroll/engine.ts: funciones
// puras y testeables, el glue con Supabase vive en las server actions.

/** Rango razonable para el ajuste de tarifa de un partner (% sobre el total). */
export const PARTNER_RATE_ADJUSTMENT_MIN = -50
export const PARTNER_RATE_ADJUSTMENT_MAX = 50

/** Ajusta el total de una cotización según el % del partner. Nunca negativo. */
export function applyPartnerRateAdjustment(totalAmount: number, ratePct: number): number {
  const clampedPct = Math.min(Math.max(ratePct, PARTNER_RATE_ADJUSTMENT_MIN), PARTNER_RATE_ADJUSTMENT_MAX)
  const adjusted = totalAmount * (1 + clampedPct / 100)
  return Math.round(Math.max(adjusted, 0) * 100) / 100
}

export type PartnerCommissionType = 'percentage' | 'fixed'

/** Comisión que el operador le debe al partner por un viaje — solo cálculo, nunca mueve dinero. */
export function computePartnerCommission(
  partner: { commissionType: PartnerCommissionType; commissionValue: number },
  bookingTotalAmount: number,
): number {
  const raw =
    partner.commissionType === 'percentage'
      ? bookingTotalAmount * (partner.commissionValue / 100)
      : partner.commissionValue
  return Math.round(Math.max(raw, 0) * 100) / 100
}
