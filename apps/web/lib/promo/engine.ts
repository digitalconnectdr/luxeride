// ── Códigos promocionales — lógica pura (sin DB) ───────────────────────────────
// Mismo espíritu que lib/policy/engine.ts / lib/compliance/engine.ts: funciones
// puras y testeables, el glue con Supabase vive en las server actions.

export type PromoDiscountType = 'percentage' | 'fixed'

export interface PromoCodeForValidation {
  discountType: PromoDiscountType
  discountValue: number
  maxUses: number | null
  usesCount: number
  maxUsesPerCustomer: number | null
  validFrom: string | null
  validUntil: string | null
  minBookingAmount: number | null
  isActive: boolean
}

export type PromoValidationError =
  | 'inactive'
  | 'not_yet_valid'
  | 'expired'
  | 'max_uses_reached'
  | 'customer_limit_reached'
  | 'below_minimum'

export interface PromoValidationResult {
  valid: boolean
  error?: PromoValidationError
}

/** ¿Puede aplicarse este código a esta reserva, para este cliente, ahora mismo? */
export function validatePromoCode(
  promo: PromoCodeForValidation,
  opts: { bookingAmount: number; customerRedemptionsCount: number; now?: Date },
): PromoValidationResult {
  const now = opts.now ?? new Date()

  if (!promo.isActive) return { valid: false, error: 'inactive' }
  if (promo.validFrom && now < new Date(promo.validFrom)) return { valid: false, error: 'not_yet_valid' }
  if (promo.validUntil && now > new Date(promo.validUntil)) return { valid: false, error: 'expired' }
  if (promo.maxUses != null && promo.usesCount >= promo.maxUses) return { valid: false, error: 'max_uses_reached' }
  if (promo.maxUsesPerCustomer != null && opts.customerRedemptionsCount >= promo.maxUsesPerCustomer) {
    return { valid: false, error: 'customer_limit_reached' }
  }
  if (promo.minBookingAmount != null && opts.bookingAmount < promo.minBookingAmount) {
    return { valid: false, error: 'below_minimum' }
  }
  return { valid: true }
}

/** Monto de descuento — nunca negativo, nunca mayor al total de la reserva. */
export function computeDiscount(
  promo: Pick<PromoCodeForValidation, 'discountType' | 'discountValue'>,
  bookingAmount: number,
): number {
  const raw = promo.discountType === 'percentage' ? bookingAmount * (promo.discountValue / 100) : promo.discountValue
  const clamped = Math.min(Math.max(raw, 0), bookingAmount)
  return Math.round(clamped * 100) / 100
}
