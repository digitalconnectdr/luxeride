import { describe, it, expect } from 'vitest'
import {
  customerKey,
  ruleMatches,
  evaluateRules,
  buildRewardCode,
  expiresAt,
  type RewardRule,
  type CustomerStats,
} from './engine'

const rule = (over: Partial<RewardRule> & { id: string; triggerType: RewardRule['triggerType'] }): RewardRule => ({
  name: 'Regla',
  threshold: null,
  discountType: 'percentage',
  discountValue: 10,
  validDays: 90,
  ...over,
})

const stats = (over: Partial<CustomerStats> = {}): CustomerStats => ({
  tripsCompleted: 1,
  totalSpent: 100,
  daysSincePreviousTrip: null,
  justSubmittedReview: false,
  ...over,
})

describe('customerKey', () => {
  it('normaliza el email a minúsculas', () => {
    expect(customerKey('Juan@Mail.COM', null)).toBe('juan@mail.com')
    expect(customerKey('  juan@mail.com  ', null)).toBe('juan@mail.com')
  })

  it('el mismo cliente escrito distinto da UNA sola clave', () => {
    // Si esto fallara, la misma regla le regalaría dos códigos a la misma
    // persona: el UNIQUE de reward_grants se apoya en esta clave.
    expect(customerKey('Juan@Mail.com', null)).toBe(customerKey('juan@mail.com', null))
  })

  it('sin email usa el teléfono, solo dígitos', () => {
    expect(customerKey(null, '+1 (809) 555-1234')).toBe('18095551234')
    expect(customerKey('', '809-555-1234')).toBe('8095551234')
  })

  it('el email gana sobre el teléfono cuando hay ambos', () => {
    expect(customerKey('a@b.com', '8095551234')).toBe('a@b.com')
  })

  it('sin identidad usable devuelve null (no se puede premiar a un anónimo)', () => {
    expect(customerKey(null, null)).toBeNull()
    expect(customerKey('', '123')).toBeNull() // teléfono demasiado corto
  })
})

describe('ruleMatches', () => {
  it('first_trip solo en el primer viaje', () => {
    const r = rule({ id: 'r', triggerType: 'first_trip' })
    expect(ruleMatches(r, stats({ tripsCompleted: 1 }))).toBe(true)
    expect(ruleMatches(r, stats({ tripsCompleted: 2 }))).toBe(false)
  })

  it('review_submitted premia el ACTO, sin mirar la puntuación', () => {
    // No existe campo de estrellas en CustomerStats a propósito: premiar
    // puntuaciones altas viola la política de Google y corrompe drivers.rating.
    const r = rule({ id: 'r', triggerType: 'review_submitted' })
    expect(ruleMatches(r, stats({ justSubmittedReview: true }))).toBe(true)
    expect(ruleMatches(r, stats({ justSubmittedReview: false }))).toBe(false)
  })

  it('trips_completed dispara al alcanzar el umbral', () => {
    const r = rule({ id: 'r', triggerType: 'trips_completed', threshold: 5 })
    expect(ruleMatches(r, stats({ tripsCompleted: 4 }))).toBe(false)
    expect(ruleMatches(r, stats({ tripsCompleted: 5 }))).toBe(true)
  })

  it('trips_completed sigue disparando por encima del umbral (no se pierde)', () => {
    // Si la evaluación falló en el viaje 5, el cliente la recibe en el 6 en
    // vez de perderla para siempre. El UNIQUE evita el doble regalo.
    const r = rule({ id: 'r', triggerType: 'trips_completed', threshold: 5 })
    expect(ruleMatches(r, stats({ tripsCompleted: 9 }))).toBe(true)
  })

  it('total_spent dispara al acumular el monto', () => {
    const r = rule({ id: 'r', triggerType: 'total_spent', threshold: 500 })
    expect(ruleMatches(r, stats({ totalSpent: 499.99 }))).toBe(false)
    expect(ruleMatches(r, stats({ totalSpent: 500 }))).toBe(true)
  })

  it('inactivity_days: un cliente NUEVO no cuenta como reconquista', () => {
    const r = rule({ id: 'r', triggerType: 'inactivity_days', threshold: 60 })
    // Sin viaje previo no "volvió" de ninguna parte.
    expect(ruleMatches(r, stats({ daysSincePreviousTrip: null }))).toBe(false)
    expect(ruleMatches(r, stats({ daysSincePreviousTrip: 59 }))).toBe(false)
    expect(ruleMatches(r, stats({ daysSincePreviousTrip: 60 }))).toBe(true)
  })

  it('una regla con umbral faltante nunca dispara (no regala por error)', () => {
    const r = rule({ id: 'r', triggerType: 'trips_completed', threshold: null })
    expect(ruleMatches(r, stats({ tripsCompleted: 999 }))).toBe(false)
  })
})

describe('evaluateRules', () => {
  it('excluye las reglas que este cliente ya recibió', () => {
    const r1 = rule({ id: 'ya-dada', triggerType: 'first_trip' })
    const r2 = rule({ id: 'nueva', triggerType: 'trips_completed', threshold: 1 })
    const got = evaluateRules([r1, r2], stats({ tripsCompleted: 1 }), new Set(['ya-dada']))
    expect(got.map((r) => r.id)).toEqual(['nueva'])
  })

  it('devuelve TODAS las que califican, no solo la primera', () => {
    const porViajes = rule({ id: 'viajes', triggerType: 'trips_completed', threshold: 10 })
    const porGasto  = rule({ id: 'gasto',  triggerType: 'total_spent',     threshold: 1000 })
    const got = evaluateRules(
      [porViajes, porGasto],
      stats({ tripsCompleted: 10, totalSpent: 1000 }),
      new Set(),
    )
    expect(got.map((r) => r.id).sort()).toEqual(['gasto', 'viajes'])
  })

  it('sin reglas activas no otorga nada', () => {
    expect(evaluateRules([], stats(), new Set())).toEqual([])
  })
})

describe('buildRewardCode', () => {
  const bytes = new Uint8Array([0, 1, 2, 3])

  it('arma prefijo + sufijo', () => {
    expect(buildRewardCode('GRACIAS', bytes)).toBe('GRACIAS-ABCD')
  })

  it('quita acentos sin comerse la letra', () => {
    // "PREMIÓ" debe quedar "PREMIO", no "PREMI".
    expect(buildRewardCode('premió', bytes)).toBe('PREMIO-ABCD')
  })

  it('quita espacios y símbolos que romperían el código', () => {
    expect(buildRewardCode('5to viaje!', bytes)).toBe('5TOVIAJE-ABCD')
  })

  it('cae a PREMIO si el prefijo queda vacío tras limpiar', () => {
    expect(buildRewardCode('¡!¿?', bytes)).toBe('PREMIO-ABCD')
  })

  it('nunca usa caracteres ambiguos (I, O, 0, 1) en el sufijo', () => {
    // El pasajero puede leer el código de una pantalla y teclearlo en otra.
    const ambiguos = /[IO01]/
    for (let b = 0; b < 32; b++) {
      const code = buildRewardCode('X', new Uint8Array([b, b, b, b]))
      expect(ambiguos.test(code.split('-')[1]!)).toBe(false)
    }
  })

  it('recorta prefijos muy largos', () => {
    expect(buildRewardCode('ABCDEFGHIJKLMNOP', bytes).split('-')[0]).toHaveLength(10)
  })
})

describe('expiresAt', () => {
  it('suma los días de vigencia de la regla', () => {
    const r = rule({ id: 'r', triggerType: 'first_trip', validDays: 30 })
    const now = new Date('2026-07-01T12:00:00Z')
    expect(expiresAt(r, now)).toBe('2026-07-31T12:00:00.000Z')
  })
})
