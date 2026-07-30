import { describe, it, expect } from 'vitest'
import { computeAccountSla, type AccountBooking } from './sla'

const booking = (over: Partial<AccountBooking>): AccountBooking => ({
  status: 'completed',
  scheduled_at: '2026-07-01T12:00:00.000Z',
  arrived_at: '2026-07-01T12:00:00.000Z',
  ...over,
})

describe('computeAccountSla', () => {
  it('sin viajes relevantes, devuelve todo null', () => {
    expect(computeAccountSla([])).toEqual({ punctualityPct: null, cancellationPct: null, completedCount: 0 })
    expect(computeAccountSla([booking({ status: 'pending' })])).toEqual({
      punctualityPct: null,
      cancellationPct: null,
      completedCount: 0,
    })
  })

  it('todos a tiempo = 100% puntualidad, 0% cancelación', () => {
    const bookings = [
      booking({}),
      booking({ scheduled_at: '2026-07-01T13:00:00.000Z', arrived_at: '2026-07-01T13:05:00.000Z' }),
    ]
    const sla = computeAccountSla(bookings)
    expect(sla.punctualityPct).toBe(100)
    expect(sla.cancellationPct).toBe(0)
    expect(sla.completedCount).toBe(2)
  })

  it('llegada justo en el límite de gracia (10 min) cuenta como a tiempo', () => {
    const sla = computeAccountSla([
      booking({ scheduled_at: '2026-07-01T12:00:00.000Z', arrived_at: '2026-07-01T12:10:00.000Z' }),
    ])
    expect(sla.punctualityPct).toBe(100)
  })

  it('llegada un segundo después de la gracia cuenta como tarde', () => {
    const sla = computeAccountSla([
      booking({ scheduled_at: '2026-07-01T12:00:00.000Z', arrived_at: '2026-07-01T12:10:01.000Z' }),
    ])
    expect(sla.punctualityPct).toBe(0)
  })

  it('mezcla completados/cancelados/no-show calcula ambos % correctamente', () => {
    const bookings = [
      booking({}), // a tiempo
      booking({ arrived_at: '2026-07-01T12:20:00.000Z' }), // tarde
      booking({ status: 'cancelled', arrived_at: null }),
      booking({ status: 'no_show', arrived_at: null }),
    ]
    const sla = computeAccountSla(bookings)
    // 2 completados (1 a tiempo) => 50%
    expect(sla.punctualityPct).toBe(50)
    // 2 de 4 son problema => 50%
    expect(sla.cancellationPct).toBe(50)
    expect(sla.completedCount).toBe(2)
  })

  it('un completado sin arrived_at no cuenta para puntualidad ni como completado', () => {
    const sla = computeAccountSla([booking({ arrived_at: null })])
    expect(sla.punctualityPct).toBeNull()
    expect(sla.completedCount).toBe(0)
    expect(sla.cancellationPct).toBe(0)
  })

  it('otros estados (pending, assigned) no cuentan en ningún cálculo', () => {
    const sla = computeAccountSla([booking({}), booking({ status: 'pending' }), booking({ status: 'assigned' })])
    expect(sla.completedCount).toBe(1)
    expect(sla.punctualityPct).toBe(100)
    expect(sla.cancellationPct).toBe(0)
  })
})
