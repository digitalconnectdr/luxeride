import { describe, expect, it } from 'vitest'
import { applyPartnerRateAdjustment, computePartnerCommission } from './engine'

describe('applyPartnerRateAdjustment', () => {
  it('sin ajuste devuelve el mismo total', () => {
    expect(applyPartnerRateAdjustment(100, 0)).toBe(100)
  })

  it('descuento negativo reduce el total', () => {
    expect(applyPartnerRateAdjustment(100, -10)).toBe(90)
  })

  it('recargo positivo aumenta el total', () => {
    expect(applyPartnerRateAdjustment(100, 10)).toBe(110)
  })

  it('nunca queda negativo aunque el descuento sea extremo', () => {
    expect(applyPartnerRateAdjustment(100, -200)).toBeGreaterThanOrEqual(0)
  })

  it('el porcentaje se limita al rango razonable (clamp)', () => {
    expect(applyPartnerRateAdjustment(100, 90)).toBe(applyPartnerRateAdjustment(100, 50))
  })
})

describe('computePartnerCommission', () => {
  it('porcentaje calcula sobre el total de la reserva', () => {
    expect(computePartnerCommission({ commissionType: 'percentage', commissionValue: 10 }, 200)).toBe(20)
  })

  it('monto fijo ignora el total de la reserva', () => {
    expect(computePartnerCommission({ commissionType: 'fixed', commissionValue: 15 }, 500)).toBe(15)
  })

  it('nunca es negativo', () => {
    expect(computePartnerCommission({ commissionType: 'fixed', commissionValue: -5 }, 100)).toBe(0)
  })
})
