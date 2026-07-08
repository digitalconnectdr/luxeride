'use server'
// ── Sección J — Compliance Center: server actions ──────────────────────────
// UI operador (llenar datos) + UI super-admin (Compliance Review Queue).
// Los campos "duros" (fechas/estados indexables que consulta el cron) viven
// en columnas propias; el resto del MVP vive en la columna JSONB `compliance`.
// Después de cada escritura se recalcula compliance_status/score/bloqueo vía
// lib/compliance/recompute.ts (mismo cálculo que corre el cron diario).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import {
  recomputeCompanyCompliance,
  recomputeDriverCompliance,
  recomputeVehicleCompliance,
} from '@/lib/compliance/recompute'

export type ComplianceActionResult = { success: boolean; error?: string }

function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string ?? '').trim()
  return v || null
}
function date(fd: FormData, key: string): string | null {
  return (fd.get(key) as string) || null
}

// ── Empresa (owner) ────────────────────────────────────────────────────────

export async function updateCompanyComplianceAction(
  _prev: ComplianceActionResult | null,
  formData: FormData,
): Promise<ComplianceActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()

  const compliance = {
    legal_name: str(formData, 'legal_name'),
    dba: str(formData, 'dba'),
    entity_type: str(formData, 'entity_type'),
    state_of_registration: str(formData, 'state_of_registration'),
    state_registration_number: str(formData, 'state_registration_number'),
    ein_last4: str(formData, 'ein_last4')?.slice(0, 4) ?? null,
    county: str(formData, 'county'),
    zip_code: str(formData, 'zip_code'),
    operation_areas: str(formData, 'operation_areas'),
    operating_license_type: str(formData, 'operating_license_type'),
    operating_license_number: str(formData, 'operating_license_number'),
    operating_license_jurisdiction: str(formData, 'operating_license_jurisdiction'),
    operates_interstate: formData.get('operates_interstate') === 'true',
    usdot_number: str(formData, 'usdot_number'),
    mc_number: str(formData, 'mc_number'),
    commercial_insurance_carrier: str(formData, 'commercial_insurance_carrier'),
    commercial_insurance_policy_number: str(formData, 'commercial_insurance_policy_number'),
    internal_notes: str(formData, 'internal_notes'),
  }

  const { error } = await admin
    .from('companies')
    .update({
      compliance,
      operating_license_expires_at: date(formData, 'operating_license_expires_at'),
      commercial_insurance_expires_at: date(formData, 'commercial_insurance_expires_at'),
    })
    .eq('id', user.company_id)

  if (error) return { success: false, error: error.message }

  await recomputeCompanyCompliance(admin, user.company_id)
  revalidatePath('/admin/compliance')
  return { success: true }
}

// ── Conductor (owner/admin) ────────────────────────────────────────────────

export async function updateDriverComplianceAction(
  driverId: string,
  _prev: ComplianceActionResult | null,
  formData: FormData,
): Promise<ComplianceActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: driver } = await admin.from('drivers').select('company_id').eq('id', driverId).single()
  if (driver?.company_id !== user.company_id) return { success: false, error: 'No encontrado' }

  const compliance = {
    chauffeur_permit_type: str(formData, 'chauffeur_permit_type'),
    chauffeur_permit_number: str(formData, 'chauffeur_permit_number'),
    chauffeur_permit_jurisdiction: str(formData, 'chauffeur_permit_jurisdiction'),
    license_class: str(formData, 'license_class'),
  }

  const { error } = await admin
    .from('drivers')
    .update({
      compliance,
      chauffeur_permit_expires_at: date(formData, 'chauffeur_permit_expires_at'),
    })
    .eq('id', driverId)

  if (error) return { success: false, error: error.message }

  await recomputeDriverCompliance(admin, driverId)
  revalidatePath(`/admin/drivers/${driverId}`)
  revalidatePath('/admin/compliance')
  return { success: true }
}

// ── Vehículo (owner/admin) ─────────────────────────────────────────────────

export async function updateVehicleComplianceAction(
  vehicleId: string,
  _prev: ComplianceActionResult | null,
  formData: FormData,
): Promise<ComplianceActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: vehicle } = await admin.from('vehicles').select('company_id').eq('id', vehicleId).single()
  if (vehicle?.company_id !== user.company_id) return { success: false, error: 'No encontrado' }

  const inspectionStatusRaw = formData.get('inspection_status') as string
  const inspection_status = inspectionStatusRaw === 'passed' || inspectionStatusRaw === 'failed' ? inspectionStatusRaw : null

  const compliance = {
    forhire_permit_number: str(formData, 'forhire_permit_number'),
    forhire_permit_jurisdiction: str(formData, 'forhire_permit_jurisdiction'),
    inspection_status,
    insurance_carrier: str(formData, 'insurance_carrier'),
    insurance_policy_number: str(formData, 'insurance_policy_number'),
  }

  const { error } = await admin
    .from('vehicles')
    .update({
      compliance,
      forhire_permit_expires_at: date(formData, 'forhire_permit_expires_at'),
      inspection_date: date(formData, 'inspection_date'),
    })
    .eq('id', vehicleId)

  if (error) return { success: false, error: error.message }

  await recomputeVehicleCompliance(admin, vehicleId)
  revalidatePath(`/admin/fleet/${vehicleId}`)
  revalidatePath('/admin/compliance')
  return { success: true }
}

// ── Super-admin: Compliance Review Queue ───────────────────────────────────

type ReviewEntity = 'company' | 'driver' | 'vehicle'

export async function markComplianceReviewedAction(
  entity: ReviewEntity,
  id: string,
): Promise<ComplianceActionResult> {
  const user = await requireRole('super_admin')
  const admin = createAdminClient()
  const table = entity === 'company' ? 'companies' : entity === 'driver' ? 'drivers' : 'vehicles'

  const { error } = await admin
    .from(table)
    .update({ compliance_last_reviewed_at: new Date().toISOString(), compliance_reviewed_by: user.id })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  if (entity === 'company') await recomputeCompanyCompliance(admin, id)
  else if (entity === 'driver') await recomputeDriverCompliance(admin, id)
  else await recomputeVehicleCompliance(admin, id)

  revalidatePath('/super-admin/compliance')
  return { success: true }
}
