import { describe, expect, it } from 'vitest'
import { overlaps, windowFor } from './auto-assign'

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
