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

function isPast(dateStr: string | null, now: Date): boolean {
  if (!dateStr) return false
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

export function computeDriverCompliance(input: DriverComplianceInput, now: Date = new Date()): ComplianceResult {
  const deductions: Deduction[] = []

  if (!input.licenseNumber || !input.licenseState) {
    deductions.push({ points: 10, reason: 'Falta información de la licencia de conducir' })
  }
  if (isPast(input.licenseExpiry, now)) {
    deductions.push({ points: 30, reason: 'Licencia de conducir vencida', blocking: true })
  }

  if (!input.chauffeurPermitNumber || !input.chauffeurPermitJurisdiction) {
    deductions.push({ points: 15, reason: 'Falta el permiso chauffeur/for-hire' })
  } else if (isPast(input.chauffeurPermitExpiresAt, now)) {
    deductions.push({ points: 30, reason: 'Permiso chauffeur/for-hire vencido', blocking: true })
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

export function computeVehicleCompliance(input: VehicleComplianceInput, now: Date = new Date()): ComplianceResult {
  const deductions: Deduction[] = []

  if (!input.insuranceExpiresAt) {
    deductions.push({ points: 15, reason: 'Falta fecha de vencimiento del seguro' })
  } else if (isPast(input.insuranceExpiresAt, now)) {
    deductions.push({ points: 25, reason: 'Seguro comercial vencido', blocking: true })
  }

  if (!input.forhirePermitNumber || !input.forhirePermitJurisdiction) {
    deductions.push({ points: 15, reason: 'Falta el permiso for-hire del vehículo' })
  } else if (isPast(input.forhirePermitExpiresAt, now)) {
    deductions.push({ points: 30, reason: 'Permiso for-hire del vehículo vencido', blocking: true })
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

export function computeCompanyCompliance(input: CompanyComplianceInput, now: Date = new Date()): CompanyComplianceResult {
  const deductions: Deduction[] = []

  if (!input.legalName || !input.stateRegistrationNumber) {
    deductions.push({ points: 10, reason: 'Falta identidad legal (nombre legal / número de registro estatal)' })
  }

  if (!input.operatingLicenseNumber) {
    deductions.push({ points: 15, reason: 'Falta la licencia operativa for-hire' })
  } else if (isPast(input.operatingLicenseExpiresAt, now)) {
    deductions.push({ points: 25, reason: 'Licencia operativa for-hire vencida' })
  }

  if (input.operatesInterstate && !input.usdotNumber) {
    deductions.push({ points: 20, reason: 'Opera entre estados sin número USDOT' })
  }

  if (isPast(input.commercialInsuranceExpiresAt, now)) {
    deductions.push({ points: 25, reason: 'Seguro comercial de la empresa vencido' })
  }

  if (input.fleetBlockedPct >= 50) {
    deductions.push({ points: 20, reason: `${Math.round(input.fleetBlockedPct)}% de la flota está bloqueada por cumplimiento` })
  }

  const base = finalize(deductions, input.manualReviewRequired)
  // La empresa nunca se bloquea automáticamente — solo se alerta.
  return { ...base, blocked: false, blockReason: null, alert: deductions.length > 0 }
}
