import { describe, expect, it } from 'vitest'
import { computeDriverEarnings } from './engine'

describe('computeDriverEarnings', () => {
  it('comision: % del total de cada viaje', () => {
    const trips = [{ totalAmount: 100 }, { totalAmount: 200 }]
    expect(computeDriverEarnings(trips, 'commission', 10)).toBe(30)
  })

  it('tarifa fija: monto por viaje sin importar el total cobrado', () => {
    const trips = [{ totalAmount: 100 }, { totalAmount: 500 }, { totalAmount: 50 }]
    expect(computeDriverEarnings(trips, 'flat_per_trip', 15)).toBe(45)
  })

  it('sin viajes, no hay nada que pagar', () => {
    expect(computeDriverEarnings([], 'commission', 10)).toBe(0)
  })

  it('tarifa/comision en cero no paga nada', () => {
    expect(computeDriverEarnings([{ totalAmount: 100 }], 'commission', 0)).toBe(0)
  })
})
