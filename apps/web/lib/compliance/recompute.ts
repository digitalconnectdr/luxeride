// ── Sección J — Compliance Center: glue de DB (no puro, a diferencia de engine.ts) ──
// Recalcula y persiste compliance_status/score/operational_block/block_reason
// para un conductor, un vehículo, o la empresa completa. Se llama:
//   1. Inmediatamente después de que el operador edita un campo de compliance.
//   2. Desde el cron diario (recompute-alerts), para capturar vencimientos
//      puros por el paso del tiempo (nadie tocó el registro).
//   3. Después de que super-admin marca un registro como "revisado".
//
// "manual_review_required" se DERIVA de compliance_last_reviewed_at IS NULL —
// no es una columna. Una vez revisado una vez, el estado ya sale del cálculo
// puro (score/bloqueo) y deja de mostrarse forzado a 'pending_review'.

import type { createAdminClient } from '@/lib/supabase/server'
import {
  computeDriverCompliance,
  computeVehicleCompliance,
  computeCompanyCompliance,
} from './engine'

type Admin = ReturnType<typeof createAdminClient>

export async function recomputeDriverCompliance(admin: Admin, driverId: string): Promise<void> {
  const { data: driver } = await admin
    .from('drivers')
    .select('license_number, license_state, license_expiry, chauffeur_permit_expires_at, compliance, compliance_last_reviewed_at, company_id')
    .eq('id', driverId)
    .single()
  if (!driver) return

  const compliance = (driver.compliance as { chauffeur_permit_number?: string; chauffeur_permit_jurisdiction?: string } | null) ?? {}
  const result = computeDriverCompliance({
    licenseNumber: driver.license_number,
    licenseState: driver.license_state,
    licenseExpiry: driver.license_expiry,
    chauffeurPermitNumber: compliance.chauffeur_permit_number ?? null,
    chauffeurPermitJurisdiction: compliance.chauffeur_permit_jurisdiction ?? null,
    chauffeurPermitExpiresAt: driver.chauffeur_permit_expires_at,
    manualReviewRequired: driver.compliance_last_reviewed_at === null,
  })

  await admin
    .from('drivers')
    .update({
      compliance_status: result.status,
      compliance_score: result.score,
      operational_block: result.blocked,
      block_reason: result.blockReason,
    })
    .eq('id', driverId)

  await recomputeCompanyCompliance(admin, driver.company_id)
}

export async function recomputeVehicleCompliance(admin: Admin, vehicleId: string): Promise<void> {
  const { data: vehicle } = await admin
    .from('vehicles')
    .select('insurance_expires_at, forhire_permit_expires_at, inspection_date, compliance, compliance_last_reviewed_at, company_id')
    .eq('id', vehicleId)
    .single()
  if (!vehicle) return

  const compliance = (vehicle.compliance as { forhire_permit_number?: string; forhire_permit_jurisdiction?: string; inspection_status?: 'passed' | 'failed' } | null) ?? {}
  const result = computeVehicleCompliance({
    insuranceExpiresAt: vehicle.insurance_expires_at,
    forhirePermitNumber: compliance.forhire_permit_number ?? null,
    forhirePermitJurisdiction: compliance.forhire_permit_jurisdiction ?? null,
    forhirePermitExpiresAt: vehicle.forhire_permit_expires_at,
    inspectionDate: vehicle.inspection_date,
    inspectionStatus: compliance.inspection_status ?? null,
    manualReviewRequired: vehicle.compliance_last_reviewed_at === null,
  })

  await admin
    .from('vehicles')
    .update({
      compliance_status: result.status,
      compliance_score: result.score,
      operational_block: result.blocked,
      block_reason: result.blockReason,
    })
    .eq('id', vehicleId)

  await recomputeCompanyCompliance(admin, vehicle.company_id)
}

export async function recomputeCompanyCompliance(admin: Admin, companyId: string): Promise<{ alert: boolean } | null> {
  const [{ data: company }, { data: drivers }, { data: vehicles }] = await Promise.all([
    admin
      .from('companies')
      .select('compliance, operating_license_expires_at, commercial_insurance_expires_at, compliance_last_reviewed_at')
      .eq('id', companyId)
      .single(),
    admin.from('drivers').select('operational_block').eq('company_id', companyId),
    admin.from('vehicles').select('operational_block').eq('company_id', companyId),
  ])
  if (!company) return null

  const fleetTotal = (drivers?.length ?? 0) + (vehicles?.length ?? 0)
  const fleetBlocked =
    (drivers ?? []).filter((d) => d.operational_block).length +
    (vehicles ?? []).filter((v) => v.operational_block).length
  const fleetBlockedPct = fleetTotal > 0 ? (fleetBlocked / fleetTotal) * 100 : 0

  const compliance = (company.compliance as {
    legal_name?: string
    state_registration_number?: string
    operating_license_number?: string
    operates_interstate?: boolean
    usdot_number?: string
  } | null) ?? {}

  const result = computeCompanyCompliance({
    legalName: compliance.legal_name ?? null,
    stateRegistrationNumber: compliance.state_registration_number ?? null,
    operatingLicenseNumber: compliance.operating_license_number ?? null,
    operatingLicenseExpiresAt: company.operating_license_expires_at,
    operatesInterstate: Boolean(compliance.operates_interstate),
    usdotNumber: compliance.usdot_number ?? null,
    commercialInsuranceExpiresAt: company.commercial_insurance_expires_at,
    fleetBlockedPct,
    manualReviewRequired: company.compliance_last_reviewed_at === null,
  })

  await admin
    .from('companies')
    .update({
      compliance_status: result.status,
      compliance_score: result.score,
      compliance_alert: result.alert,
    })
    .eq('id', companyId)

  return { alert: result.alert }
}
