import { describe, expect, it } from 'vitest'
import { isAddonActive, isAddonIncludedInPlan } from './addons'

describe('isAddonIncludedInPlan', () => {
  it('incluye Elite y Enterprise', () => {
    expect(isAddonIncludedInPlan('elite')).toBe(true)
    expect(isAddonIncludedInPlan('enterprise')).toBe(true)
  })

  it('no incluye Starter/Professional/Free', () => {
    expect(isAddonIncludedInPlan('starter')).toBe(false)
    expect(isAddonIncludedInPlan('professional')).toBe(false)
    expect(isAddonIncludedInPlan('free')).toBe(false)
  })
})

describe('isAddonActive', () => {
  it('activo si el plan lo incluye, sin importar el flag manual', () => {
    expect(isAddonActive('elite', false)).toBe(true)
  })

  it('activo si el flag manual esta prendido, aunque el plan no lo incluya', () => {
    expect(isAddonActive('starter', true)).toBe(true)
  })

  it('inactivo si ni el plan lo incluye ni el flag esta prendido', () => {
    expect(isAddonActive('professional', false)).toBe(false)
  })
})
