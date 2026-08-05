import { describe, it, expect } from 'vitest'
import {
  parsePolicy,
  parseBookingWindow,
  computeCancellationFee,
  validateBookingTime,
  canModifyBooking,
  DEFAULT_POLICY,
} from './engine'

const NOW = new Date('2026-06-17T12:00:00Z')

function hoursFromNow(h: number): Date {
  return new Date(NOW.getTime() + h * 3_600_000)
}

describe('parsePolicy', () => {
  it('devuelve defaults con settings vacíos o inválidos', () => {
    expect(parsePolicy(null)).toEqual(DEFAULT_POLICY)
    expect(parsePolicy({})).toEqual(DEFAULT_POLICY)
    expect(parsePolicy({ policy: { late_cancellation_fee_pct: 'x' } })).toEqual(DEFAULT_POLICY)
  })

  it('acota porcentajes a 0–100 y horas a >= 0', () => {
    const p = parsePolicy({
      policy: {
        late_cancellation_fee_pct: 150,
        no_show_fee_pct: -5,
        free_cancellation_hours: -10,
      },
    })
    expect(p.late_cancellation_fee_pct).toBe(100)
    expect(p.no_show_fee_pct).toBe(0)
    expect(p.free_cancellation_hours).toBe(DEFAULT_POLICY.free_cancellation_hours)
  })
})

describe('computeCancellationFee', () => {
  const policy = {
    free_cancellation_hours: 24,
    late_cancellation_fee_pct: 50,
    no_show_fee_pct: 100,
    modification_min_hours: 4,
    no_show_grace_minutes: 10,
  }

  it('cancelación fuera de la ventana es gratis', () => {
    const fee = computeCancellationFee(policy, hoursFromNow(48), 100, { now: NOW })
    expect(fee).toEqual({ kind: 'free', feePct: 0, feeAmount: 0 })
  })

  it('cancelación dentro de la ventana cobra el % configurado', () => {
    const fee = computeCancellationFee(policy, hoursFromNow(6), 100, { now: NOW })
    expect(fee.kind).toBe('late')
    expect(fee.feeAmount).toBe(50)
  })

  it('no-show cobra su % aunque falte mucho para el viaje', () => {
    const fee = computeCancellationFee(policy, hoursFromNow(48), 80, {
      noShow: true,
      now: NOW,
    })
    expect(fee.kind).toBe('no_show')
    expect(fee.feeAmount).toBe(80)
  })

  it('redondea a 2 decimales y nunca cobra sobre montos negativos', () => {
    const fee = computeCancellationFee(policy, hoursFromNow(1), 33.335, { now: NOW })
    expect(fee.feeAmount).toBe(16.67)
    const negative = computeCancellationFee(policy, hoursFromNow(1), -50, { now: NOW })
    expect(negative.feeAmount).toBe(0)
  })
})

describe('validateBookingTime', () => {
  const window = { advance_booking_hours: 2, max_advance_days: 90 }

  it('acepta dentro de la ventana', () => {
    expect(validateBookingTime(window, hoursFromNow(5), NOW).valid).toBe(true)
  })

  it('rechaza con menos anticipación que la mínima', () => {
    const result = validateBookingTime(window, hoursFromNow(1), NOW)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('anticipación')
  })

  it('rechaza más allá del máximo de días', () => {
    const result = validateBookingTime(window, hoursFromNow(91 * 24), NOW)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('90')
  })

  it('rechaza fechas inválidas', () => {
    expect(validateBookingTime(window, new Date('invalid'), NOW).valid).toBe(false)
  })
})

describe('canModifyBooking', () => {
  const policy = { ...DEFAULT_POLICY, modification_min_hours: 4 }

  it('permite modificar con suficiente anticipación', () => {
    expect(canModifyBooking(policy, hoursFromNow(5), NOW)).toBe(true)
  })

  it('bloquea modificación demasiado cerca del viaje', () => {
    expect(canModifyBooking(policy, hoursFromNow(2), NOW)).toBe(false)
  })
})
