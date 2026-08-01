import { describe, it, expect } from 'vitest'
import { addIsoDays, isoDateStartOfMonth, getZonedIsoDate, getZonedWeekday, zonedMidnightUtc } from './zoned-bounds'

const TZ_SD = 'America/Santo_Domingo' // UTC-4 todo el año, sin horario de verano
const TZ_NY = 'America/New_York'      // con horario de verano

describe('addIsoDays', () => {
  it('suma días dentro del mismo mes', () => {
    expect(addIsoDays('2026-06-17', 3)).toBe('2026-06-20')
  })
  it('cruza el límite de mes', () => {
    expect(addIsoDays('2026-06-30', 1)).toBe('2026-07-01')
  })
  it('resta días (negativo)', () => {
    expect(addIsoDays('2026-06-03', -5)).toBe('2026-05-29')
  })
})

describe('isoDateStartOfMonth', () => {
  it('reemplaza el día por 01', () => {
    expect(isoDateStartOfMonth('2026-06-17')).toBe('2026-06-01')
  })
})

describe('getZonedIsoDate', () => {
  it('11pm UTC del 31-dic ya es 1-ene en Santo Domingo (UTC-4)', () => {
    // 2026-01-01T02:00:00Z = 2025-12-31 22:00 en UTC-4 → sigue siendo 31 dic
    expect(getZonedIsoDate(new Date('2026-01-01T02:00:00Z'), TZ_SD)).toBe('2025-12-31')
    // 2026-01-01T05:00:00Z = 2026-01-01 01:00 en UTC-4 → ya es 1 ene
    expect(getZonedIsoDate(new Date('2026-01-01T05:00:00Z'), TZ_SD)).toBe('2026-01-01')
  })
  it('cae a UTC si no hay timezone', () => {
    expect(getZonedIsoDate(new Date('2026-06-17T18:00:00Z'), null)).toBe('2026-06-17')
  })
})

describe('getZonedWeekday', () => {
  it('miércoles en UTC puede seguir siendo martes en hora local (offset negativo)', () => {
    // 2026-06-17 es miércoles. 00:30 UTC del miércoles = 20:30 martes en UTC-4.
    expect(getZonedWeekday(new Date('2026-06-17T00:30:00Z'), TZ_SD)).toBe(2) // martes
  })
  it('cae a UTC si no hay timezone', () => {
    expect(getZonedWeekday(new Date('2026-06-17T18:00:00Z'), null)).toBe(3) // miércoles
  })
})

describe('zonedMidnightUtc', () => {
  it('medianoche en Santo Domingo (UTC-4) es 04:00 UTC', () => {
    const midnight = zonedMidnightUtc('2026-06-17', TZ_SD)
    expect(midnight.toISOString()).toBe('2026-06-17T04:00:00.000Z')
  })
  it('respeta el horario de verano en New York (UTC-4 en junio, UTC-5 en enero)', () => {
    const summer = zonedMidnightUtc('2026-06-17', TZ_NY)
    expect(summer.toISOString()).toBe('2026-06-17T04:00:00.000Z')
    const winter = zonedMidnightUtc('2026-01-17', TZ_NY)
    expect(winter.toISOString()).toBe('2026-01-17T05:00:00.000Z')
  })
  it('sin timezone, trata la fecha como UTC', () => {
    expect(zonedMidnightUtc('2026-06-17', null).toISOString()).toBe('2026-06-17T00:00:00.000Z')
  })
})
