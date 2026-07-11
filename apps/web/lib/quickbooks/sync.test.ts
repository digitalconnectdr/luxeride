import { describe, expect, it } from 'vitest'
import { normalizeCustomerName } from './sync'

describe('normalizeCustomerName', () => {
  it('unifica distinta capitalizacion', () => {
    expect(normalizeCustomerName('Steephany Vargas')).toBe(normalizeCustomerName('steephany vargas'))
  })

  it('colapsa espacios repetidos y recorta los extremos', () => {
    expect(normalizeCustomerName('  Steephany   Vargas  ')).toBe('steephany vargas')
  })

  it('NO unifica errores de tipeo reales (no es fuzzy-match)', () => {
    expect(normalizeCustomerName('Stephany Vargas')).not.toBe(normalizeCustomerName('Steephany Vargas'))
  })
})
