import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { CompanyComplianceForm, type CompanyComplianceCurrent } from '@/components/admin/company-compliance-form'
import { COMPLIANCE_STATUS_CLS } from '@/lib/compliance/status-badge'
import type { ComplianceStatus } from '@/lib/compliance/engine'
import { getDict } from '@/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: getDict().admin.compliance.title }
}

export default async function CompliancePage() {
  const user = await requireRole('company_owner', 'company_admin')
  const companyId = user.company_id!
  const admin = createAdminClient()
  const t = getDict().admin.compliance

  const [{ data: company }, { data: blockedDrivers }, { data: blockedVehicles }] = await Promise.all([
    admin
      .from('companies')
      .select('compliance, operating_license_expires_at, commercial_insurance_expires_at, compliance_status, compliance_score, compliance_alert')
      .eq('id', companyId)
      .single(),
    admin
      .from('drivers')
      .select('id, block_reason, user_profiles!inner(first_name, last_name)')
      .eq('company_id', companyId)
      .eq('operational_block', true),
    admin
      .from('vehicles')
      .select('id, make, model, plate_number, block_reason')
      .eq('company_id', companyId)
      .eq('operational_block', true),
  ])

  const compliance = (company?.compliance as Partial<CompanyComplianceCurrent> | null) ?? {}
  const status = (company?.compliance_status ?? 'pending_review') as ComplianceStatus

  const current: CompanyComplianceCurrent = {
    legal_name: compliance.legal_name ?? '',
    dba: compliance.dba ?? '',
    entity_type: compliance.entity_type ?? '',
    state_of_registration: compliance.state_of_registration ?? '',
    state_registration_number: compliance.state_registration_number ?? '',
    ein_last4: compliance.ein_last4 ?? '',
    county: compliance.county ?? '',
    zip_code: compliance.zip_code ?? '',
    operation_areas: compliance.operation_areas ?? '',
    operating_license_type: compliance.operating_license_type ?? '',
    operating_license_number: compliance.operating_license_number ?? '',
    operating_license_jurisdiction: compliance.operating_license_jurisdiction ?? '',
    operating_license_expires_at: company?.operating_license_expires_at?.slice(0, 10) ?? '',
    operates_interstate: Boolean(compliance.operates_interstate),
    usdot_number: compliance.usdot_number ?? '',
    mc_number: compliance.mc_number ?? '',
    commercial_insurance_carrier: compliance.commercial_insurance_carrier ?? '',
    commercial_insurance_policy_number: compliance.commercial_insurance_policy_number ?? '',
    commercial_insurance_expires_at: company?.commercial_insurance_expires_at?.slice(0, 10) ?? '',
    internal_notes: compliance.internal_notes ?? '',
  }

  type BlockedDriverRow = { id: string; block_reason: string | null; user_profiles: { first_name: string; last_name: string } }
  type BlockedVehicleRow = { id: string; make: string; model: string; plate_number: string; block_reason: string | null }

  const drivers = (blockedDrivers ?? []) as unknown as BlockedDriverRow[]
  const vehicles = (blockedVehicles ?? []) as unknown as BlockedVehicleRow[]

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      {/* Company status */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.companyStatusTitle}</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${COMPLIANCE_STATUS_CLS[status]}`}>
              {t.statuses[status]}
            </span>
            <span className="text-xs text-sl-on-surface-muted">{t.score}: {company?.compliance_score ?? 0}/100</span>
          </div>
        </div>
        {company?.compliance_alert && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5">
            <p className="text-xs text-amber-800">{t.alertBanner}</p>
          </div>
        )}
      </div>

      {/* Fleet summary */}
      {(drivers.length > 0 || vehicles.length > 0) && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.fleetSummaryTitle}</p>
          {drivers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-sl-on-surface-muted">{t.driversBlocked} ({drivers.length})</p>
              {drivers.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sl-on-surface">{d.user_profiles.first_name} {d.user_profiles.last_name}</span>
                    {d.block_reason && <span className="text-red-400/80 ml-2">| {d.block_reason}</span>}
                  </div>
                  <Link href={`/admin/drivers/${d.id}`} className="text-bronze hover:text-bronze/80 shrink-0">{t.viewDriver}</Link>
                </div>
              ))}
            </div>
          )}
          {vehicles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-sl-on-surface-muted">{t.vehiclesBlocked} ({vehicles.length})</p>
              {vehicles.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sl-on-surface">{v.make} {v.model} · {v.plate_number}</span>
                    {v.block_reason && <span className="text-red-400/80 ml-2">| {v.block_reason}</span>}
                  </div>
                  <Link href={`/admin/fleet/${v.id}`} className="text-bronze hover:text-bronze/80 shrink-0">{t.viewVehicle}</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {drivers.length === 0 && vehicles.length === 0 && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <p className="text-xs text-sl-on-surface-muted">{t.noIssues}</p>
        </div>
      )}

      <CompanyComplianceForm current={current} labels={t} />
    </div>
  )
}
