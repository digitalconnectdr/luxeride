import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, hasAnyPreference, summarizePreferences, toPreferences } from './preferences'

describe('toPreferences', () => {
  it('sin fila (perfil nunca guardado), cae a los defaults', () => {
    expect(toPreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(toPreferences(undefined)).toEqual(DEFAULT_PREFERENCES)
  })

  it('lee snake_case (fila real de BD) — incluye género y favorito', () => {
    const p = toPreferences({
      conversation: 'quiet',
      temperature: 'no_preference',
      music: 'no_preference',
      luggage_help: false,
      standing_notes: null,
      preferred_vehicle_type_id: null,
      preferred_driver_gender: 'female',
      favorite_driver_id: 'driver-123',
    })
    expect(p.preferredDriverGender).toBe('female')
    expect(p.favoriteDriverId).toBe('driver-123')
  })

  it('lee camelCase (copia congelada en bookings.passenger_preferences)', () => {
    const p = toPreferences({
      preferredDriverGender: 'male',
      favoriteDriverId: 'driver-456',
    })
    expect(p.preferredDriverGender).toBe('male')
    expect(p.favoriteDriverId).toBe('driver-456')
  })

  it('sin género/favorito en la fila, cae a "sin preferencia" / null', () => {
    const p = toPreferences({ conversation: 'chatty' })
    expect(p.preferredDriverGender).toBe('no_preference')
    expect(p.favoriteDriverId).toBeNull()
  })
})

describe('hasAnyPreference', () => {
  it('todo en default: no hay nada que mostrar', () => {
    expect(hasAnyPreference(DEFAULT_PREFERENCES)).toBe(false)
  })

  it('preferencia de género distinta de "sin preferencia" cuenta como preferencia', () => {
    expect(hasAnyPreference({ ...DEFAULT_PREFERENCES, preferredDriverGender: 'female' })).toBe(true)
  })

  it('favorito guardado cuenta como preferencia', () => {
    expect(hasAnyPreference({ ...DEFAULT_PREFERENCES, favoriteDriverId: 'driver-1' })).toBe(true)
  })
})

describe('summarizePreferences', () => {
  it('incluye la preferencia de género cuando no es "sin preferencia"', () => {
    const out = summarizePreferences({ ...DEFAULT_PREFERENCES, preferredDriverGender: 'female' })
    expect(out).toContain('Prefiere conductora')
  })

  it('omite género cuando es "sin preferencia"', () => {
    const out = summarizePreferences(DEFAULT_PREFERENCES)
    expect(out.some((l) => l.toLowerCase().includes('conductor'))).toBe(false)
  })
})
