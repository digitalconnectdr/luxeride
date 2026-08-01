// ── Sección J — Compliance Center: motor de cumplimiento ──────────────────────
// Funciones puras, testeables sin DB (mismo patrón que lib/policy/engine.ts).
//
// 3 capas del diseño:
//   1. Declarado  — lo llena el operador (campos en `compliance` JSONB + fechas).
//   2. Calculado  — estas funciones: score 0-100, status, bloqueo operativo.
//   3. Revisado   — aprobación admin una sola vez (manual_review_required).
//
// Reglas de bloqueo (solo conductor/vehículo, NUNCA la empresa):
//   conductor bloqueado si licencia o permiso chauffeur vencido.
//   vehículo bloqueado si seguro, permiso for-hire vencidos o inspección reprobada.
// La empresa solo se ALERTA (nunca se bloquea automáticamente).

import { addIsoDays, zonedMidnightUtc } from '@/lib/time/zoned-bounds'

export type ComplianceStatus = 'compliant' | 'partial' | 'at_risk' | 'non_compliant' | 'pending_review'

export interface ComplianceResult {
  status: ComplianceStatus
  score: number
  blocked: boolean
  blockReason: string | null
  reasons: string[]
}

interface Deduction {
  points: number
  reason: string
  blocking?: boolean
}

function finalize(deductions: Deduction[], manualReviewRequired: boolean): ComplianceResult {
  const score = Math.max(0, 100 - deductions.reduce((sum, d) => sum + d.points, 0))
  const blockingReasons = deductions.filter((d) => d.blocking).map((d) => d.reason)
  const blocked = blockingReasons.length > 0
  const reasons = deductions.map((d) => d.reason)

  let status: ComplianceStatus
  if (blocked) status = 'non_compliant'
  else if (manualReviewRequired) status = 'pending_review'
  else if (score >= 90) status = 'compliant'
  else if (score >= 70) status = 'partial'
  else if (score >= 40) status = 'at_risk'
  else status = 'non_compliant'

  return { status, score, blocked, blockReason: blockingReasons[0] ?? null, reasons }
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * ¿Ya venció esta fecha? La mayoría de estos campos son columnas DATE
 * ('YYYY-MM-DD', sin hora) — el documento sigue vigente todo el día de
 * vencimiento en la zona horaria de la EMPRESA. Comparar `new Date(dateStr)`
 * a secas lo trata como medianoche UTC, lo que bloquea a un conductor/vehículo
 * hasta 4h (en un país como RD, UTC-4) antes de que su licencia/seguro
 * realmente expire. Mismo criterio que lib/pricing/engine.ts para recargos.
 * `vehicles.insurance_expires_at` es la excepción (TIMESTAMPTZ heredado de
 * antes del Compliance Center): ya es un instante absoluto sin ambigüedad,
 * se compara tal cual.
 */
function isPast(dateStr: string | null, now: Date, timezone: string | null | undefined): boolean {
  if (!dateStr) return false
  if (DATE_ONLY_RE.test(dateStr)) {
    const expiresAt = zonedMidnightUtc(addIsoDays(dateStr, 1), timezone)
    return now >= expiresAt
  }
  const d = new Date(dateStr)
  return !Number.isNaN(d.getTime()) && d < now
}

// ─── Conductor ────────────────────────────────────────────────────────────────

export interface DriverComplianceInput {
  licenseNumber: string | null
  licenseState: string | null
  licenseExpiry: string | null
  chauffeurPermitNumber: string | null
  chauffeurPermitJurisdiction: string | null
  chauffeurPermitExpiresAt: string | null
  manualReviewRequired: boolean
}

export function computeDriverCompliance(
  input: DriverComplianceInput,
  now: Date = new Date(),
  timezone?: string | null,
): ComplianceResult {
  const deductions: Deduction[] = []

  if (!input.licenseNumber) {
    deductions.push({ points: 15, reason: 'Falta el número de licencia de conducir' })
  }
  if (!input.licenseState) {
    deductions.push({ points: 10, reason: 'Falta el estado emisor de la licencia' })
  }
  if (isPast(input.licenseExpiry, now, timezone)) {
    deductions.push({ points: 30, reason: 'Licencia de conducir vencida', blocking: true })
  } else if (!input.licenseExpiry) {
    deductions.push({ points: 10, reason: 'Falta la fecha de vencimiento de la licencia' })
  }

  if (!input.chauffeurPermitNumber || !input.chauffeurPermitJurisdiction) {
    deductions.push({ points: 20, reason: 'Falta el permiso chauffeur/for-hire' })
  } else if (isPast(input.chauffeurPermitExpiresAt, now, timezone)) {
    deductions.push({ points: 30, reason: 'Permiso chauffeur/for-hire vencido', blocking: true })
  } else if (!input.chauffeurPermitExpiresAt) {
    deductions.push({ points: 10, reason: 'Falta la fecha de vencimiento del permiso chauffeur/for-hire' })
  }

  return finalize(deductions, input.manualReviewRequired)
}

// ─── Vehículo ───────────────────────────────────────────────────────────────

export interface VehicleComplianceInput {
  insuranceExpiresAt: string | null
  forhirePermitNumber: string | null
  forhirePermitJurisdiction: string | null
  forhirePermitExpiresAt: string | null
  inspectionDate: string | null
  inspectionStatus: 'passed' | 'failed' | null
  manualReviewRequired: boolean
}

export function computeVehicleCompliance(
  input: VehicleComplianceInput,
  now: Date = new Date(),
  timezone?: string | null,
): ComplianceResult {
  const deductions: Deduction[] = []

  if (isPast(input.insuranceExpiresAt, now, timezone)) {
    deductions.push({ points: 25, reason: 'Seguro comercial vencido', blocking: true })
  } else if (!input.insuranceExpiresAt) {
    deductions.push({ points: 15, reason: 'Falta fecha de vencimiento del seguro' })
  }

  if (!input.forhirePermitNumber || !input.forhirePermitJurisdiction) {
    deductions.push({ points: 20, reason: 'Falta el permiso for-hire del vehículo' })
  } else if (isPast(input.forhirePermitExpiresAt, now, timezone)) {
    deductions.push({ points: 30, reason: 'Permiso for-hire del vehículo vencido', blocking: true })
  } else if (!input.forhirePermitExpiresAt) {
    deductions.push({ points: 10, reason: 'Falta la fecha de vencimiento del permiso for-hire' })
  }

  if (input.inspectionStatus === 'failed') {
    deductions.push({ points: 30, reason: 'Inspección vehicular reprobada', blocking: true })
  } else if (!input.inspectionDate) {
    deductions.push({ points: 10, reason: 'Falta fecha de inspección' })
  }

  return finalize(deductions, input.manualReviewRequired)
}

// ─── Empresa (solo alerta, nunca bloquea) ─────────────────────────────────────

export interface CompanyComplianceInput {
  legalName: string | null
  stateRegistrationNumber: string | null
  operatingLicenseNumber: string | null
  operatingLicenseExpiresAt: string | null
  operatesInterstate: boolean
  usdotNumber: string | null
  commercialInsuranceExpiresAt: string | null
  /** % (0-100) de la flota (conductores + vehículos) actualmente bloqueada */
  fleetBlockedPct: number
  manualReviewRequired: boolean
}

export interface CompanyComplianceResult extends ComplianceResult {
  alert: boolean
}

export function computeCompanyCompliance(
  input: CompanyComplianceInput,
  now: Date = new Date(),
  timezone?: string | null,
): CompanyComplianceResult {
  const deductions: Deduction[] = []

  if (!input.legalName) {
    deductions.push({ points: 10, reason: 'Falta el nombre legal de la empresa' })
  }
  if (!input.stateRegistrationNumber) {
    deductions.push({ points: 10, reason: 'Falta el número de registro estatal' })
  }

  if (!input.operatingLicenseNumber) {
    deductions.push({ points: 15, reason: 'Falta la licencia operativa for-hire' })
  } else if (isPast(input.operatingLicenseExpiresAt, now, timezone)) {
    deductions.push({ points: 25, reason: 'Licencia operativa for-hire vencida' })
  } else if (!input.operatingLicenseExpiresAt) {
    deductions.push({ points: 10, reason: 'Falta la fecha de vencimiento de la licencia operativa' })
  }

  if (input.operatesInterstate && !input.usdotNumber) {
    deductions.push({ points: 20, reason: 'Opera entre estados sin número USDOT' })
  }

  if (isPast(input.commercialInsuranceExpiresAt, now, timezone)) {
    deductions.push({ points: 25, reason: 'Seguro comercial de la empresa vencido' })
  } else if (!input.commercialInsuranceExpiresAt) {
    deductions.push({ points: 10, reason: 'Falta la fecha de vencimiento del seguro comercial' })
  }

  if (input.fleetBlockedPct >= 50) {
    deductions.push({ points: 20, reason: `${Math.round(input.fleetBlockedPct)}% de la flota está bloqueada por cumplimiento` })
  }

  const base = finalize(deductions, input.manualReviewRequired)
  // La empresa nunca se bloquea automáticamente — solo se alerta.
  return { ...base, blocked: false, blockReason: null, alert: deductions.length > 0 }
}
