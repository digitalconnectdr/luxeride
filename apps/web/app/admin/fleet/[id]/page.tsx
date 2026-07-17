import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { VehicleStatusSelect, DriverAssignSelect } from '@/components/admin/fleet-controls'
import { updateVehicleMaintenanceAction } from '@/app/actions/fleet'
import { VehicleComplianceForm } from '@/components/admin/vehicle-compliance-form'
import { COMPLIANCE_STATUS_CLS } from '@/lib/compliance/status-badge'
import type { ComplianceStatus } from '@/lib/compliance/engine'
import type { VehicleStatus } from '@/lib/supabase/database.types'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-MX', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.vehicleDetail.title }
}

const STATUS_CLS: Record<VehicleStatus, string> = {
  available:   'bg-green-500/10 text-green-400 border-green-500/20',
  on_trip:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  maintenance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  offline:     'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40',
  retired:     'bg-sl-outline-variant/10 text-sl-on-surface-muted border-sl-outline-variant/20',
}

interface PageProps {
  params: { id: string }
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'accounting')
  const companyId = user.company_id!
  const admin = createAdminClient()

  const { data: vehicle } = await admin
    .from('vehicles')
    .select(`
      id, make, model, year, color, plate_number, vin, status,
      vehicle_type_id, current_driver_id, mileage,
      last_maintenance_at, next_maintenance_at, insurance_expires_at,
      notes, created_at,
      compliance, forhire_permit_expires_at, inspection_date,
      compliance_status, compliance_score, operational_block, block_reason
    `)
    .eq('id', params.id)
    .eq('company_id', companyId)       // IDOR guard
    .single()

  if (!vehicle) notFound()

  const t = getDict().admin.vehicleDetail
  const fleetDict = getDict().admin.fleet
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  const [{ data: vehicleType }, { data: drivers }] = await Promise.all([
    vehicle.vehicle_type_id
      ? admin.from('vehicle_types').select('id, name, class, capacity').eq('id', vehicle.vehicle_type_id).single()
      : Promise.resolve({ data: null }),
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', companyId)
      .eq('role', 'driver'),
  ])

  const badgeCls = STATUS_CLS[vehicle.status]
  const badgeLabel = fleetDict.statuses[vehicle.status]
  const isAccounting = user.role === 'accounting'

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // void cast — regla del proyecto para pasar server actions con args ya
  // vinculados como `action` de un <form> (mismo patrón que /admin/settings).
  const maintenanceAction: (fd: FormData) => void = updateVehicleMaintenanceAction.bind(null, vehicle.id)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <nav className="text-xs text-sl-on-surface-muted mb-2">
          <Link href="/admin/fleet" className="hover:text-sl-on-surface transition-colors">{fleetDict.title}</Link>
          <span className="mx-1.5">›</span>
          <span className="text-sl-on-surface">{vehicle.year} {vehicle.make} {vehicle.model}</span>
        </nav>
        <div className="flex items-center gap-4">
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeCls}`}>
            {badgeLabel}
          </span>
        </div>
        <div className="w-8 h-[3px] bg-gold mt-2 mb-1 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted">
          {vehicle.plate_number}{vehicle.color ? ` · ${vehicle.color}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Status & Driver management ── */}
        {!isAccounting && (
          <div className="lg:col-span-2 space-y-4">

            {/* Status */}
            <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.statusLabel}</p>
              <VehicleStatusSelect vehicleId={vehicle.id} current={vehicle.status} statuses={fleetDict.statuses} saving={fleetDict.saving} />
            </div>

            {/* Driver assignment */}
            <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                {t.assignedDriver}
              </p>
              <DriverAssignSelect
                vehicleId={vehicle.id}
                currentDriverId={vehicle.current_driver_id}
                drivers={drivers ?? []}
                unassigned={fleetDict.unassigned}
              />
              {vehicle.current_driver_id && (
                <Link
                  href={`/admin/drivers/${vehicle.current_driver_id}`}
                  className="text-xs text-bronze hover:text-bronze/80 transition-colors"
                >
                  {t.viewDriverProfile}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Vehicle info card ── */}
        <div className={isAccounting ? 'lg:col-span-3' : ''}>
          <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3 h-full">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              {t.vehicleInfo}
            </p>
            <dl className="space-y-2.5">
              {[
                { label: t.type,         value: vehicleType?.name ?? '—' },
                { label: t.vehicleClass, value: vehicleType?.class ? vehicleType.class.charAt(0).toUpperCase() + vehicleType.class.slice(1) : '—' },
                { label: t.capacity,     value: vehicleType?.capacity ? `${vehicleType.capacity} ${t.passengers}` : '—' },
                { label: t.vin,          value: vehicle.vin ?? '—' },
                { label: t.mileage,      value: vehicle.mileage ? `${vehicle.mileage.toLocaleString(localeTag)} km` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-baseline gap-4">
                  <dt className="text-xs text-sl-on-surface-muted shrink-0">{label}</dt>
                  <dd className="text-xs text-sl-on-surface text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

      </div>

      {/* ── Maintenance & Insurance ── */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-4">
          {t.maintenanceInsurance}
        </p>
        {isAccounting ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: t.lastMaintenance, value: formatDate(vehicle.last_maintenance_at), warn: false },
              { label: t.nextMaintenance, value: formatDate(vehicle.next_maintenance_at),
                warn: vehicle.next_maintenance_at ? new Date(vehicle.next_maintenance_at) < new Date() : false },
              { label: t.insuranceExpires, value: formatDate(vehicle.insurance_expires_at),
                warn: vehicle.insurance_expires_at ? new Date(vehicle.insurance_expires_at) < new Date() : false },
            ].map(({ label, value, warn }) => (
              <div key={label} className="space-y-1">
                <p className="text-xs text-sl-on-surface-muted">{label}</p>
                <p className={`text-sm font-medium ${warn ? 'text-red-400' : 'text-sl-on-surface'}`}>{value}</p>
                {warn && <p className="text-[10px] text-red-400">{t.expired}</p>}
              </div>
            ))}
          </div>
        ) : (
          <form action={maintenanceAction} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1.5">{t.mileage}</label>
                <input
                  type="number"
                  name="mileage"
                  min="0"
                  defaultValue={vehicle.mileage ?? ''}
                  className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
                />
              </div>
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1.5">{t.lastMaintenance}</label>
                <input
                  type="date"
                  name="last_maintenance_at"
                  defaultValue={vehicle.last_maintenance_at?.slice(0, 10) ?? ''}
                  className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
                />
              </div>
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1.5">{t.nextMaintenance}</label>
                <input
                  type="date"
                  name="next_maintenance_at"
                  defaultValue={vehicle.next_maintenance_at?.slice(0, 10) ?? ''}
                  className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
                />
              </div>
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1.5">{t.insuranceExpires}</label>
                <input
                  type="date"
                  name="insurance_expires_at"
                  defaultValue={vehicle.insurance_expires_at?.slice(0, 10) ?? ''}
                  className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
                {t.saveMaintenance}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Compliance (Sección J) ── */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            {t.complianceTitle}
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${COMPLIANCE_STATUS_CLS[vehicle.compliance_status as ComplianceStatus]}`}>
              {getDict().admin.compliance.statuses[vehicle.compliance_status as ComplianceStatus]}
            </span>
            <span className="text-[10px] text-sl-on-surface-muted">{t.complianceScore} {vehicle.compliance_score}</span>
          </div>
        </div>

        {vehicle.operational_block && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5">
            <p className="text-xs text-red-400 font-medium">{t.complianceBlocked}</p>
            {vehicle.block_reason && <p className="text-xs text-red-400/80 mt-0.5">{t.complianceBlockReason}: {vehicle.block_reason}</p>}
          </div>
        )}

        {!isAccounting && (
          <VehicleComplianceForm
            vehicleId={vehicle.id}
            current={{
              forhire_permit_number: (vehicle.compliance as { forhire_permit_number?: string } | null)?.forhire_permit_number ?? '',
              forhire_permit_jurisdiction: (vehicle.compliance as { forhire_permit_jurisdiction?: string } | null)?.forhire_permit_jurisdiction ?? '',
              forhire_permit_expires_at: vehicle.forhire_permit_expires_at?.slice(0, 10) ?? '',
              inspection_date: vehicle.inspection_date?.slice(0, 10) ?? '',
              inspection_status: (vehicle.compliance as { inspection_status?: string } | null)?.inspection_status ?? '',
              insurance_carrier: (vehicle.compliance as { insurance_carrier?: string } | null)?.insurance_carrier ?? '',
              insurance_policy_number: (vehicle.compliance as { insurance_policy_number?: string } | null)?.insurance_policy_number ?? '',
            }}
            labels={t}
          />
        )}
      </div>

      {/* ── Notes ── */}
      {vehicle.notes && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">{t.notes}</p>
          <p className="text-sm text-sl-on-surface whitespace-pre-line">{vehicle.notes}</p>
        </div>
      )}

      {/* ── Footer meta ── */}
      <p className="text-xs text-sl-on-surface-muted">
        {t.registeredOn.replace('{date}', formatDate(vehicle.created_at))}
      </p>
    </div>
  )
}
