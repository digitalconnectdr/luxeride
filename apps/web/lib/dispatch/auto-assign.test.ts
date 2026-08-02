import { describe, expect, it } from 'vitest'
import { matchesGenderPreference, overlaps, pickFavoriteDriver, windowFor } from './auto-assign'

describe('windowFor/overlaps (conflicto de horario conductor/vehículo)', () => {
  it('dos viajes seguidos sin margen suficiente se consideran en conflicto', () => {
    const a = windowFor('2026-08-01T10:00:00.000Z', 60)
    const b = windowFor('2026-08-01T11:00:00.000Z', 60) // arranca justo cuando "termina" a
    expect(overlaps(a, b)).toBe(true)
  })

  it('dos viajes con margen suficiente entre ellos no están en conflicto', () => {
    const a = windowFor('2026-08-01T10:00:00.000Z', 60)
    const b = windowFor('2026-08-01T13:00:00.000Z', 60) // 2h de separación tras el buffer
    expect(overlaps(a, b)).toBe(false)
  })

  it('el mismo horario exacto siempre es conflicto', () => {
    const a = windowFor('2026-08-01T10:00:00.000Z', 90)
    const b = windowFor('2026-08-01T10:00:00.000Z', 90)
    expect(overlaps(a, b)).toBe(true)
  })

  it('sin duration_minutes usa la duración por defecto (60min) para el cálculo', () => {
    const a = windowFor('2026-08-01T10:00:00.000Z', null)
    const b = windowFor('2026-08-01T10:00:00.000Z', 60)
    expect(a).toEqual(b)
  })
})

describe('matchesGenderPreference (preferencia de género del conductor)', () => {
  it('sin preferencia, cualquier conductor califica, incluso sin género declarado', () => {
    expect(matchesGenderPreference(null, 'no_preference')).toBe(true)
    expect(matchesGenderPreference('female', 'no_preference')).toBe(true)
    expect(matchesGenderPreference('male', 'no_preference')).toBe(true)
  })

  it('con preferencia, solo el conductor que coincide exactamente califica', () => {
    expect(matchesGenderPreference('female', 'female')).toBe(true)
    expect(matchesGenderPreference('male', 'female')).toBe(false)
  })

  it('con preferencia, un conductor sin género declarado NO califica (no se asume)', () => {
    expect(matchesGenderPreference(null, 'female')).toBe(false)
    expect(matchesGenderPreference(null, 'male')).toBe(false)
  })
})

describe('pickFavoriteDriver (best-effort, nunca bloquea)', () => {
  it('sin favorito guardado, no elige a nadie', () => {
    expect(pickFavoriteDriver(['a', 'b'], null)).toBeNull()
  })

  it('favorito disponible entre los candidatos: lo elige', () => {
    expect(pickFavoriteDriver(['a', 'b', 'c'], 'b')).toBe('b')
  })

  it('favorito guardado pero NO disponible ahora mismo: no bloquea, devuelve null', () => {
    expect(pickFavoriteDriver(['a', 'c'], 'b')).toBeNull()
  })
})
