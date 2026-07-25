import { describe, it, expect } from 'vitest'
import {
  scoreDrivers,
  parseDispatchWeights,
  haversineMiles,
  DEFAULT_DISPATCH_WEIGHTS,
  NEUTRAL_PROXIMITY_SCORE,
  NEUTRAL_RATING_SCORE,
  type DriverScoreInput,
} from './scoring'

const driver = (over: Partial<DriverScoreInput> & { driverId: string }): DriverScoreInput => ({
  tripsToday: 0,
  rating: null,
  distanceMiles: null,
  recentRejections: 0,
  ...over,
})

describe('haversineMiles', () => {
  it('mismo punto = 0', () => {
    expect(haversineMiles({ lat: 18.48, lng: -69.93 }, { lat: 18.48, lng: -69.93 })).toBe(0)
  })

  it('Santo Domingo → Santiago ≈ 90 millas', () => {
    const d = haversineMiles({ lat: 18.4861, lng: -69.9312 }, { lat: 19.4517, lng: -70.6970 })
    expect(d).toBeGreaterThan(80)
    expect(d).toBeLessThan(100)
  })
})

describe('parseDispatchWeights', () => {
  it('sin configuración usa los pesos por defecto', () => {
    expect(parseDispatchWeights(null)).toEqual(DEFAULT_DISPATCH_WEIGHTS)
    expect(parseDispatchWeights({})).toEqual(DEFAULT_DISPATCH_WEIGHTS)
  })

  it('respeta los valores válidos y sustituye los inválidos', () => {
    const w = parseDispatchWeights({ proximity: 60, fairness: 'x', rating: -5, reliability: 10 })
    expect(w.proximity).toBe(60)
    expect(w.fairness).toBe(DEFAULT_DISPATCH_WEIGHTS.fairness)
    expect(w.rating).toBe(DEFAULT_DISPATCH_WEIGHTS.rating)
    expect(w.reliability).toBe(10)
  })

  it('todo en cero vuelve a los defaults (evita división por cero)', () => {
    expect(parseDispatchWeights({ proximity: 0, fairness: 0, rating: 0, reliability: 0 }))
      .toEqual(DEFAULT_DISPATCH_WEIGHTS)
  })
})

describe('scoreDrivers', () => {
  it('con todo igual, gana el que está más cerca', () => {
    const ranked = scoreDrivers([
      driver({ driverId: 'lejos', distanceMiles: 20 }),
      driver({ driverId: 'cerca', distanceMiles: 2 }),
    ])
    expect(ranked[0].driverId).toBe('cerca')
  })

  it('sin GPS se usa el puntaje neutro, no cero', () => {
    const ranked = scoreDrivers([driver({ driverId: 'a' })])
    expect(ranked[0].proximity).toBe(NEUTRAL_PROXIMITY_SCORE)
  })

  it('el conductor sin GPS le gana al que está muy lejos', () => {
    const ranked = scoreDrivers([
      driver({ driverId: 'lejisimos', distanceMiles: 40 }),
      driver({ driverId: 'sin-gps' }),
    ])
    expect(ranked[0].driverId).toBe('sin-gps')
  })

  it('reparto justo: con misma distancia gana el que menos viajes lleva hoy', () => {
    const ranked = scoreDrivers([
      driver({ driverId: 'cargado', tripsToday: 5, distanceMiles: 5 }),
      driver({ driverId: 'libre', tripsToday: 0, distanceMiles: 5 }),
    ])
    expect(ranked[0].driverId).toBe('libre')
    expect(ranked[0].fairness).toBe(100)
    expect(ranked[1].fairness).toBe(0)
  })

  it('si todos llevan los mismos viajes, el reparto no discrimina', () => {
    const ranked = scoreDrivers([
      driver({ driverId: 'a', tripsToday: 3 }),
      driver({ driverId: 'b', tripsToday: 3 }),
    ])
    expect(ranked.every((r) => r.fairness === 100)).toBe(true)
  })

  it('conductor nuevo sin calificación no queda penalizado', () => {
    const ranked = scoreDrivers([driver({ driverId: 'nuevo' })])
    expect(ranked[0].rating).toBe(NEUTRAL_RATING_SCORE)
  })

  it('mejor calificación gana con el resto igual', () => {
    const ranked = scoreDrivers([
      driver({ driverId: 'tres', rating: 3, distanceMiles: 5 }),
      driver({ driverId: 'cinco', rating: 5, distanceMiles: 5 }),
    ])
    expect(ranked[0].driverId).toBe('cinco')
    expect(ranked[0].rating).toBe(100)
  })

  it('los rechazos recientes bajan la confiabilidad y pueden costar el viaje', () => {
    const ranked = scoreDrivers([
      driver({ driverId: 'rechaza', recentRejections: 4, distanceMiles: 5 }),
      driver({ driverId: 'cumple', recentRejections: 0, distanceMiles: 5 }),
    ])
    expect(ranked[0].driverId).toBe('cumple')
    expect(ranked[1].reliability).toBe(20)
  })

  it('la confiabilidad nunca baja de 0 por muchos rechazos que haya', () => {
    const ranked = scoreDrivers([driver({ driverId: 'a', recentRejections: 99 })])
    expect(ranked[0].reliability).toBe(0)
  })

  it('los pesos cambian el ganador: con proximidad en 0 manda el reparto', () => {
    const inputs = [
      driver({ driverId: 'cerca-cargado', distanceMiles: 1, tripsToday: 6 }),
      driver({ driverId: 'lejos-libre', distanceMiles: 20, tripsToday: 0 }),
    ]
    expect(scoreDrivers(inputs)[0].driverId).toBe('lejos-libre')
    const soloProximidad = { proximity: 100, fairness: 0, rating: 0, reliability: 0 }
    expect(scoreDrivers(inputs, soloProximidad)[0].driverId).toBe('cerca-cargado')
  })

  it('empate total → orden determinista por id (misma entrada, mismo resultado)', () => {
    const inputs = [driver({ driverId: 'zzz' }), driver({ driverId: 'aaa' })]
    expect(scoreDrivers(inputs).map((r) => r.driverId)).toEqual(['aaa', 'zzz'])
    expect(scoreDrivers([...inputs].reverse()).map((r) => r.driverId)).toEqual(['aaa', 'zzz'])
  })

  it('un solo candidato siempre sale elegido', () => {
    const ranked = scoreDrivers([driver({ driverId: 'unico', tripsToday: 20, recentRejections: 10 })])
    expect(ranked).toHaveLength(1)
    expect(ranked[0].driverId).toBe('unico')
  })
})
