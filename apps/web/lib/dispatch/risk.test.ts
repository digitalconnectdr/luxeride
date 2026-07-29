import { describe, it, expect } from 'vitest'
import { isDriverAtRisk, RISK_WINDOW_MINUTES, STALE_POSITION_MINUTES } from './risk'

// Santo Domingo, punto de referencia estable para todos los casos.
const PICKUP = { lat: 18.4861, lng: -69.9312 }
const NOW = new Date('2026-07-29T12:00:00.000Z')

function minutesFromNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000)
}

describe('isDriverAtRisk', () => {
  it('fuera de la ventana de riesgo, nunca hay riesgo aunque no haya GPS', () => {
    expect(
      isDriverAtRisk({
        scheduledAt: minutesFromNow(RISK_WINDOW_MINUTES + 30),
        pickup: PICKUP,
        lastPosition: null,
        lastPositionAt: null,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('pickup ya pasado (viaje en curso o retrasado más allá del pickup) no cuenta como riesgo nuevo', () => {
    expect(
      isDriverAtRisk({
        scheduledAt: minutesFromNow(-5),
        pickup: PICKUP,
        lastPosition: PICKUP,
        lastPositionAt: NOW,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('dentro de la ventana y sin ninguna posición reportada = riesgo', () => {
    expect(
      isDriverAtRisk({
        scheduledAt: minutesFromNow(30),
        pickup: PICKUP,
        lastPosition: null,
        lastPositionAt: null,
        now: NOW,
      }),
    ).toBe(true)
  })

  it('dentro de la ventana pero con posición vieja (GPS stale) = riesgo', () => {
    expect(
      isDriverAtRisk({
        scheduledAt: minutesFromNow(30),
        pickup: PICKUP,
        lastPosition: PICKUP,
        lastPositionAt: minutesFromNow(-(STALE_POSITION_MINUTES + 5)),
        now: NOW,
      }),
    ).toBe(true)
  })

  it('posición reciente y muy cerca del pickup = sin riesgo', () => {
    expect(
      isDriverAtRisk({
        scheduledAt: minutesFromNow(30),
        pickup: PICKUP,
        lastPosition: { lat: 18.487, lng: -69.932 }, // a metros del pickup
        lastPositionAt: minutesFromNow(-2),
        now: NOW,
      }),
    ).toBe(false)
  })

  it('posición reciente pero demasiado lejos para llegar a tiempo = riesgo', () => {
    expect(
      isDriverAtRisk({
        scheduledAt: minutesFromNow(10), // solo 10 min para el pickup
        pickup: PICKUP,
        lastPosition: { lat: 19.4517, lng: -70.697 }, // Santiago, ~90 millas
        lastPositionAt: minutesFromNow(-1),
        now: NOW,
      }),
    ).toBe(true)
  })

  it('posición reciente, lejos pero con tiempo suficiente a velocidad conservadora = sin riesgo', () => {
    expect(
      isDriverAtRisk({
        scheduledAt: minutesFromNow(RISK_WINDOW_MINUTES), // el máximo de la ventana
        pickup: PICKUP,
        lastPosition: { lat: 18.55, lng: -69.98 }, // unas pocas millas
        lastPositionAt: minutesFromNow(-1),
        now: NOW,
      }),
    ).toBe(false)
  })
})
