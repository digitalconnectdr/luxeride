import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { COMPLIANCE_STATUS_CLS } from '@/lib/compliance/status-badge'
import type { ComplianceStatus } from '@/lib/compliance/engine'
import { MarkReviewedButton } from '@/components/super-admin/mark-reviewed-button'

export const metadata: Metadata = { title: 'Compliance Review Queue' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  compliant: 'Cumple',
  partial: 'Parcial',
  at_risk: 'En riesgo',
  non_compliant: 'No cumple',
  pending_review: 'Pendiente de revisión',
}

function Badge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${COMPLIANCE_STATUS_CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export default async function ComplianceReviewQueuePage() {
  await requireRole('super_admin')
  const admin = createAdminClient()

  const [{ data: companies }, { data: drivers }, { data: vehicles }] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, slug, compliance_status, compliance_score, compliance_alert, compliance_last_reviewed_at')
      .order('compliance_status'),
    admin
      .from('drivers')
      .select('id, company_id, compliance_status, compliance_score, operational_block, block_reason, compliance_last_reviewed_at, companies(name), user_profiles!inner(first_name, last_name)')
      .order('compliance_status'),
    admin
      .from('vehicles')
      .select('id, company_id, make, model, plate_number, compliance_status, compliance_score, operational_block, block_reason, compliance_last_reviewed_at, companies(name)')
      .order('compliance_status'),
  ])

  type CompanyRow = { id: string; name: string; slug: string; compliance_status: ComplianceStatus; compliance_score: number; compliance_alert: boolean; compliance_last_reviewed_at: string | null }
  type DriverRow = { id: string; company_id: string; compliance_status: ComplianceStatus; compliance_score: number; operational_block: boolean; block_reason: string | null; compliance_last_reviewed_at: string | null; companies: { name: string } | null; user_profiles: { first_name: string; last_name: string } }
  type VehicleRow = { id: string; company_id: string; make: string; model: string; plate_number: string; compliance_status: ComplianceStatus; compliance_score: number; operational_block: boolean; block_reason: string | null; compliance_last_reviewed_at: string | null; companies: { name: string } | null }

  const companyRows = (companies ?? []) as unknown as CompanyRow[]
  const driverRows = (drivers ?? []) as unknown as DriverRow[]
  const vehicleRows = (vehicles ?? []) as unknown as VehicleRow[]

  const needsAttention = (s: ComplianceStatus, lastReviewed: string | null) =>
    s !== 'compliant' || lastReviewed === null

  const companiesToShow = companyRows.filter((c) => needsAttention(c.compliance_status, c.compliance_last_reviewed_at))
  const driversToShow = driverRows.filter((d) => needsAttention(d.compliance_status, d.compliance_last_reviewed_at))
  const vehiclesToShow = vehicleRows.filter((v) => needsAttention(v.compliance_status, v.compliance_last_reviewed_at))

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Compliance Review Queue</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Empresas, conductores y vehículos pendientes de revisión, en riesgo, bloqueados o incompletos.
        </p>
      </div>

      {/* Empresas */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          Empresas ({companiesToShow.length})
        </p>
        {companiesToShow.length === 0 ? (
          <p className="text-sm text-sl-on-surface-muted">Todas las empresas están al día.</p>
        ) : (
          <div className="space-y-1.5">
            {companiesToShow.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 text-sm bg-sl-bg/40 border border-sl-outline-variant rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={`/super-admin/companies/${c.id}`} className="text-sl-on-surface hover:text-bronze transition-colors truncate">
                    {c.name}
                  </Link>
                  <Badge status={c.compliance_status} />
                  <span className="text-xs text-sl-on-surface-muted shrink-0">{c.compliance_score}/100</span>
                  {c.compliance_alert && <span className="text-xs text-amber-400 shrink-0">⚠ Alerta</span>}
                </div>
                <MarkReviewedButton entity="company" id={c.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conductores */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          Conductores ({driversToShow.length})
        </p>
        {driversToShow.length === 0 ? (
          <p className="text-sm text-sl-on-surface-muted">Todos los conductores están al día.</p>
        ) : (
          <div className="space-y-1.5">
            {driversToShow.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 text-sm bg-sl-bg/40 border border-sl-outline-variant rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sl-on-surface truncate">
                    {d.user_profiles.first_name} {d.user_profiles.last_name}
                    <span className="text-sl-on-surface-muted"> · {d.companies?.name}</span>
                  </span>
                  <Badge status={d.compliance_status} />
                  {d.operational_block && d.block_reason && (
                    <span className="text-xs text-red-400 shrink-0">{d.block_reason}</span>
                  )}
                </div>
                <MarkReviewedButton entity="driver" id={d.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vehículos */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          Vehículos ({vehiclesToShow.length})
        </p>
        {vehiclesToShow.length === 0 ? (
          <p className="text-sm text-sl-on-surface-muted">Todos los vehículos están al día.</p>
        ) : (
          <div className="space-y-1.5">
            {vehiclesToShow.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 text-sm bg-sl-bg/40 border border-sl-outline-variant rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sl-on-surface truncate">
                    {v.make} {v.model} · {v.plate_number}
                    <span className="text-sl-on-surface-muted"> · {v.companies?.name}</span>
                  </span>
                  <Badge status={v.compliance_status} />
                  {v.operational_block && v.block_reason && (
                    <span className="text-xs text-red-400 shrink-0">{v.block_reason}</span>
                  )}
                </div>
                <MarkReviewedButton entity="vehicle" id={v.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
