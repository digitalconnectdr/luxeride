import { describe, it, expect } from 'vitest'
import {
  computeDriverCompliance,
  computeVehicleCompliance,
  computeCompanyCompliance,
  type DriverComplianceInput,
  type VehicleComplianceInput,
  type CompanyComplianceInput,
} from './engine'

const NOW = new Date('2026-07-08T12:00:00Z')

function daysFromNow(d: number): string {
  return new Date(NOW.getTime() + d * 86_400_000).toISOString().slice(0, 10)
}

describe('computeDriverCompliance', () => {
  const complete: DriverComplianceInput = {
    licenseNumber: 'D1234567',
    licenseState: 'FL',
    licenseExpiry: daysFromNow(365),
    chauffeurPermitNumber: 'CH-9988',
    chauffeurPermitJurisdiction: 'Miami-Dade',
    chauffeurPermitExpiresAt: daysFromNow(200),
    manualReviewRequired: false,
  }

  it('conductor completo y sin revisión pendiente queda compliant', () => {
    const r = computeDriverCompliance(complete, NOW)
    expect(r.status).toBe('compliant')
    expect(r.blocked).toBe(false)
    expect(r.score).toBe(100)
  })

  it('con manual_review_required queda pending_review aunque el score sea perfecto', () => {
    const r = computeDriverCompliance({ ...complete, manualReviewRequired: true }, NOW)
    expect(r.status).toBe('pending_review')
    expect(r.blocked).toBe(false)
  })

  it('licencia vencida bloquea sin importar la revisión manual', () => {
    const r = computeDriverCompliance(
      { ...complete, licenseExpiry: daysFromNow(-1), manualReviewRequired: true },
      NOW,
    )
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/licencia/i)
    expect(r.status).toBe('non_compliant')
  })

  it('licencia que vence HOY sigue vigente en zona horaria negativa aunque ya sea después de medianoche UTC', () => {
    // 2026-07-09 01:00 UTC = 2026-07-08 21:00 en Santo Domingo (UTC-4) — para
    // la empresa todavía es "8 de julio", así que una licencia que vence el
    // 8 de julio sigue vigente todo ese día local.
    const now = new Date('2026-07-09T01:00:00Z')
    const r = computeDriverCompliance({ ...complete, licenseExpiry: '2026-07-08' }, now, 'America/Santo_Domingo')
    expect(r.blocked).toBe(false)
  })

  it('la misma fecha sin zona horaria (fallback UTC) sí queda vencida', () => {
    const now = new Date('2026-07-09T01:00:00Z')
    const r = computeDriverCompliance({ ...complete, licenseExpiry: '2026-07-08' }, now, null)
    expect(r.blocked).toBe(true)
  })

  it('permiso chauffeur vencido bloquea', () => {
    const r = computeDriverCompliance({ ...complete, chauffeurPermitExpiresAt: daysFromNow(-5) }, NOW)
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/chauffeur/i)
  })

  it('sin permiso chauffeur no bloquea pero baja el score', () => {
    const r = computeDriverCompliance(
      { ...complete, chauffeurPermitNumber: null, chauffeurPermitJurisdiction: null },
      NOW,
    )
    expect(r.blocked).toBe(false)
    expect(r.score).toBeLessThan(100)
  })

  it('perfil casi vacío (solo licencia y permiso parcial) no debe verse casi perfecto', () => {
    // Caso real reportado: license_number sí, license_state no, sin vencimiento,
    // permiso con número pero sin jurisdicción — antes daba 75/100 (engañoso).
    const r = computeDriverCompliance(
      {
        licenseNumber: 'D9988776',
        licenseState: null,
        licenseExpiry: null,
        chauffeurPermitNumber: 'CH-1234',
        chauffeurPermitJurisdiction: null,
        chauffeurPermitExpiresAt: null,
        manualReviewRequired: true,
      },
      NOW,
    )
    expect(r.score).toBeLessThanOrEqual(60)
    expect(r.blocked).toBe(false)
    expect(r.status).toBe('pending_review')
  })

  it('conductor completamente vacío queda en zona de riesgo, no compliant', () => {
    const r = computeDriverCompliance(
      {
        licenseNumber: null,
        licenseState: null,
        licenseExpiry: null,
        chauffeurPermitNumber: null,
        chauffeurPermitJurisdiction: null,
        chauffeurPermitExpiresAt: null,
        manualReviewRequired: true,
      },
      NOW,
    )
    expect(r.score).toBeLessThanOrEqual(50)
  })
})

describe('computeVehicleCompliance', () => {
  const complete: VehicleComplianceInput = {
    insuranceExpiresAt: daysFromNow(180),
    forhirePermitNumber: 'FH-001',
    forhirePermitJurisdiction: 'Broward',
    forhirePermitExpiresAt: daysFromNow(180),
    inspectionDate: daysFromNow(-30),
    inspectionStatus: 'passed',
    manualReviewRequired: false,
  }

  it('vehículo completo queda compliant', () => {
    const r = computeVehicleCompliance(complete, NOW)
    expect(r.status).toBe('compliant')
    expect(r.blocked).toBe(false)
  })

  it('seguro vencido bloquea', () => {
    const r = computeVehicleCompliance({ ...complete, insuranceExpiresAt: daysFromNow(-1) }, NOW)
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/seguro/i)
  })

  it('inspección reprobada bloquea', () => {
    const r = computeVehicleCompliance({ ...complete, inspectionStatus: 'failed' }, NOW)
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/inspección/i)
  })

  it('permiso for-hire vencido bloquea', () => {
    const r = computeVehicleCompliance({ ...complete, forhirePermitExpiresAt: daysFromNow(-2) }, NOW)
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toMatch(/for-hire/i)
  })

  it('vehículo completamente vacío no debe verse casi perfecto', () => {
    const r = computeVehicleCompliance(
      {
        insuranceExpiresAt: null,
        forhirePermitNumber: null,
        forhirePermitJurisdiction: null,
        forhirePermitExpiresAt: null,
        inspectionDate: null,
        inspectionStatus: null,
        manualReviewRequired: true,
      },
      NOW,
    )
    expect(r.score).toBeLessThanOrEqual(60)
  })
})

describe('computeCompanyCompliance', () => {
  const complete: CompanyComplianceInput = {
    legalName: 'LuxeRide Transport LLC',
    stateRegistrationNumber: 'FL-12345',
    operatingLicenseNumber: 'OP-001',
    operatingLicenseExpiresAt: daysFromNow(300),
    operatesInterstate: false,
    usdotNumber: null,
    commercialInsuranceExpiresAt: daysFromNow(300),
    fleetBlockedPct: 0,
    manualReviewRequired: false,
  }

  it('empresa completa queda compliant y sin alerta', () => {
    const r = computeCompanyCompliance(complete, NOW)
    expect(r.status).toBe('compliant')
    expect(r.alert).toBe(false)
    expect(r.blocked).toBe(false)
  })

  it('la empresa NUNCA se bloquea, solo se alerta', () => {
    const r = computeCompanyCompliance(
      { ...complete, operatingLicenseExpiresAt: daysFromNow(-10), commercialInsuranceExpiresAt: daysFromNow(-5) },
      NOW,
    )
    expect(r.blocked).toBe(false)
    expect(r.alert).toBe(true)
  })

  it('opera entre estados sin USDOT genera alerta', () => {
    const r = computeCompanyCompliance({ ...complete, operatesInterstate: true, usdotNumber: null }, NOW)
    expect(r.alert).toBe(true)
    expect(r.reasons.some((x) => /usdot/i.test(x))).toBe(true)
  })

  it('flota mayormente bloqueada genera alerta', () => {
    const r = computeCompanyCompliance({ ...complete, fleetBlockedPct: 60 }, NOW)
    expect(r.alert).toBe(true)
  })

  it('empresa sin ningún dato de cumplimiento no debe verse casi completa', () => {
    // Caso real reportado: compliance = {} completo, nada declarado — antes daba 75/100.
    const r = computeCompanyCompliance(
      {
        legalName: null,
        stateRegistrationNumber: null,
        operatingLicenseNumber: null,
        operatingLicenseExpiresAt: null,
        operatesInterstate: false,
        usdotNumber: null,
        commercialInsuranceExpiresAt: null,
        fleetBlockedPct: 0,
        manualReviewRequired: true,
      },
      NOW,
    )
    expect(r.score).toBeLessThanOrEqual(60)
    expect(r.alert).toBe(true)
  })
})
