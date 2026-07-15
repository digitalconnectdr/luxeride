import { describe, expect, it } from 'vitest'
import { computeOnboardingChecklist, getOnboardingProgress, type OnboardingCounts } from './checklist'

const emptyCompany: OnboardingCounts = {
  vehicleTypesCount: 0,
  vehiclesCount: 0,
  serviceZonesCount: 0,
  pricingRulesCount: 0,
  paymentProviderConnected: false,
  teamOrDriversCount: 0,
  hasLogo: false,
  hasBrandColor: false,
  companyServicesCount: 0,
}

describe('computeOnboardingChecklist', () => {
  it('marca todo pendiente para una empresa recién creada', () => {
    const items = computeOnboardingChecklist(emptyCompany)
    expect(items.every((i) => !i.done)).toBe(true)
    expect(items.map((i) => i.key)).toEqual(['fleet', 'pricing', 'payments', 'team', 'branding'])
  })

  it('flota requiere AMBOS tipo de vehículo y vehículo, no solo uno', () => {
    const onlyType = computeOnboardingChecklist({ ...emptyCompany, vehicleTypesCount: 1 })
    expect(onlyType.find((i) => i.key === 'fleet')?.done).toBe(false)

    const both = computeOnboardingChecklist({ ...emptyCompany, vehicleTypesCount: 1, vehiclesCount: 1 })
    expect(both.find((i) => i.key === 'fleet')?.done).toBe(true)
  })

  it('pricing se satisface con zona O regla de precio, no ambas', () => {
    const onlyZone = computeOnboardingChecklist({ ...emptyCompany, serviceZonesCount: 1 })
    expect(onlyZone.find((i) => i.key === 'pricing')?.done).toBe(true)

    const onlyRule = computeOnboardingChecklist({ ...emptyCompany, pricingRulesCount: 1 })
    expect(onlyRule.find((i) => i.key === 'pricing')?.done).toBe(true)
  })

  it('branding requiere logo + color + al menos un servicio', () => {
    const partial = computeOnboardingChecklist({ ...emptyCompany, hasLogo: true, hasBrandColor: true })
    expect(partial.find((i) => i.key === 'branding')?.done).toBe(false)

    const complete = computeOnboardingChecklist({
      ...emptyCompany,
      hasLogo: true,
      hasBrandColor: true,
      companyServicesCount: 1,
    })
    expect(complete.find((i) => i.key === 'branding')?.done).toBe(true)
  })

  it('todo completo marca los 5 items como done', () => {
    const items = computeOnboardingChecklist({
      vehicleTypesCount: 1,
      vehiclesCount: 1,
      serviceZonesCount: 1,
      pricingRulesCount: 0,
      paymentProviderConnected: true,
      teamOrDriversCount: 1,
      hasLogo: true,
      hasBrandColor: true,
      companyServicesCount: 1,
    })
    expect(items.every((i) => i.done)).toBe(true)
  })
})

describe('getOnboardingProgress', () => {
  it('cuenta completados sobre el total', () => {
    const items = computeOnboardingChecklist({ ...emptyCompany, paymentProviderConnected: true, teamOrDriversCount: 2 })
    expect(getOnboardingProgress(items)).toEqual({ completed: 2, total: 5 })
  })
})
