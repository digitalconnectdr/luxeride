import { describe, expect, it } from 'vitest'
import { computeDiscount, validatePromoCode, type PromoCodeForValidation } from './engine'

const BASE: PromoCodeForValidation = {
  discountType: 'percentage',
  discountValue: 10,
  maxUses: null,
  usesCount: 0,
  maxUsesPerCustomer: null,
  validFrom: null,
  validUntil: null,
  minBookingAmount: null,
  isActive: true,
}

describe('validatePromoCode', () => {
  it('valido cuando no hay restricciones', () => {
    expect(validatePromoCode(BASE, { bookingAmount: 100, customerRedemptionsCount: 0 }).valid).toBe(true)
  })

  it('invalido si esta desactivado', () => {
    const r = validatePromoCode({ ...BASE, isActive: false }, { bookingAmount: 100, customerRedemptionsCount: 0 })
    expect(r).toEqual({ valid: false, error: 'inactive' })
  })

  it('invalido si ya expiro', () => {
    const r = validatePromoCode(
      { ...BASE, validUntil: '2026-01-01T00:00:00Z' },
      { bookingAmount: 100, customerRedemptionsCount: 0, now: new Date('2026-06-01T00:00:00Z') },
    )
    expect(r).toEqual({ valid: false, error: 'expired' })
  })

  it('invalido justo en el instante de validUntil (limite exclusivo)', () => {
    // validUntil se guarda como el INICIO del día siguiente al último día
    // vigente (ver createPromoCodeAction) — por eso el instante exacto ya
    // cuenta como expirado, no el "último momento válido".
    const r = validatePromoCode(
      { ...BASE, validUntil: '2026-06-01T00:00:00Z' },
      { bookingAmount: 100, customerRedemptionsCount: 0, now: new Date('2026-06-01T00:00:00Z') },
    )
    expect(r).toEqual({ valid: false, error: 'expired' })
  })

  it('valido un instante antes de validUntil', () => {
    const r = validatePromoCode(
      { ...BASE, validUntil: '2026-06-01T00:00:00.000Z' },
      { bookingAmount: 100, customerRedemptionsCount: 0, now: new Date('2026-05-31T23:59:59.999Z') },
    )
    expect(r.valid).toBe(true)
  })

  it('invalido si todavia no empieza su vigencia', () => {
    const r = validatePromoCode(
      { ...BASE, validFrom: '2026-12-01T00:00:00Z' },
      { bookingAmount: 100, customerRedemptionsCount: 0, now: new Date('2026-06-01T00:00:00Z') },
    )
    expect(r).toEqual({ valid: false, error: 'not_yet_valid' })
  })

  it('invalido si se agoto el limite total de usos', () => {
    const r = validatePromoCode(
      { ...BASE, maxUses: 5, usesCount: 5 },
      { bookingAmount: 100, customerRedemptionsCount: 0 },
    )
    expect(r).toEqual({ valid: false, error: 'max_uses_reached' })
  })

  it('invalido si el cliente ya alcanzo su limite personal', () => {
    const r = validatePromoCode(
      { ...BASE, maxUsesPerCustomer: 1 },
      { bookingAmount: 100, customerRedemptionsCount: 1 },
    )
    expect(r).toEqual({ valid: false, error: 'customer_limit_reached' })
  })

  it('invalido si la reserva no alcanza el minimo requerido', () => {
    const r = validatePromoCode(
      { ...BASE, minBookingAmount: 200 },
      { bookingAmount: 100, customerRedemptionsCount: 0 },
    )
    expect(r).toEqual({ valid: false, error: 'below_minimum' })
  })
})

describe('computeDiscount', () => {
  it('porcentaje se calcula sobre el monto de la reserva', () => {
    expect(computeDiscount({ discountType: 'percentage', discountValue: 10 }, 100)).toBe(10)
  })

  it('monto fijo se aplica tal cual', () => {
    expect(computeDiscount({ discountType: 'fixed', discountValue: 15 }, 100)).toBe(15)
  })

  it('el descuento nunca supera el total de la reserva', () => {
    expect(computeDiscount({ discountType: 'fixed', discountValue: 500 }, 100)).toBe(100)
  })

  it('el descuento nunca es negativo', () => {
    expect(computeDiscount({ discountType: 'fixed', discountValue: -20 }, 100)).toBe(0)
  })
})
