import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Info, AlertTriangle } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { VehicleStatusSelect, DriverAssignSelect } from '@/components/admin/fleet-controls'
import { VehicleTypeRow } from '@/components/admin/vehicle-type-row'
import { AddVehicleTypeForm } from '@/components/admin/add-vehicle-type-form'
import { ImportVehiclesCsv } from '@/components/admin/import-vehicles-csv'
import { getDict } from '@/lib/i18n/server'
import type { VehicleStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Fleet' }

// Mantenimiento/seguro vencido o por vencer (14 días) — mismo umbral que el
// warning visual ya usado en el detalle del vehículo (/admin/fleet/[id]).
function maintenanceAlert(nextMaintenanceAt: string | null, insuranceExpiresAt: string | null): boolean {
  const soon = Date.now() + 14 * 86_400_000
  return (
    (!!nextMaintenanceAt && new Date(nextMaintenanceAt).getTime() < soon) ||
    (!!insuranceExpiresAt && new Date(insuranceExpiresAt).getTime() < soon)
  )
}

const STATUS_BADGE: Record<VehicleStatus, string> = {
  available:   'bg-green-500/10 text-green-400 border-green-500/20',
  on_trip:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  maintenance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  offline:     'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40',
  retired:     'bg-sl-outline-variant/10 text-sl-on-surface-muted border-sl-outline-variant/20',
}

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function FleetPage({ searchParams }: PageProps) {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'accounting')
  const companyId = user.company_id!

  const tab = typeof searchParams.tab === 'string' ? searchParams.tab : 'vehicles'
  const admin = createAdminClient()

  const [{ data: vehicles }, { data: vtypes }, { data: profiles }] = await Promise.all([
    admin
      .from('vehicles')
      .select('id, make, model, year, plate_number, status, color, vehicle_type_id, current_driver_id, created_at, next_maintenance_at, insurance_expires_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    admin
      .from('vehicle_types')
      .select('id, name, class, capacity, luggage_carry_on_capacity, luggage_checked_capacity, luggage_extra_large_capacity, amenities, is_active, base_image_url')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', companyId)
      .eq('role', 'driver'),
  ])

  const allVehicles = vehicles ?? []
  const allTypes    = vtypes   ?? []
  const allDrivers  = profiles ?? []

  const typeMap = Object.fromEntries(allTypes.map((t) => [t.id, t]))

  const dict = getDict().admin
  const t = dict.fleet
  const actions = dict.actions

  const tabs = [
    { label: t.tabVehicles, value: 'vehicles' },
    { label: t.tabTypes,    value: 'types'    },
  ]

  return (
    <div className="p-8 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">
            {allVehicles.length} {t.vehicles}
            {' · '}
            {allVehicles.filter((v) => v.status === 'available').length} {t.available}
          </p>
        </div>
        {tab === 'vehicles' && (
          <div className="flex items-center gap-2.5">
            <ImportVehiclesCsv labels={t.importCsv} />
            <Link
              href="/admin/fleet/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 shadow-sm transition-colors"
            >
              <Plus size={16} strokeWidth={2.25} />
              {t.addVehicle}
            </Link>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white border border-sl-outline-variant rounded-full p-1.5 w-fit">
        {tabs.map((tb) => (
          <Link
            key={tb.value}
            href={`/admin/fleet${tb.value !== 'vehicles' ? `?tab=${tb.value}` : ''}`}
            className={[
              'px-5 py-2 rounded-full text-sm font-medium transition-all',
              tab === tb.value
                ? 'bg-gold text-gray-900 shadow-sm'
                : 'text-sl-on-surface-muted hover:text-sl-on-surface',
            ].join(' ')}
          >
            {tb.label}
          </Link>
        ))}
      </div>

      {/* Aclaración de la pestaña activa (tipos ≠ vehículos) */}
      <p className="flex items-center gap-2 text-xs text-sl-on-surface-muted max-w-2xl">
        <Info size={14} className="text-bronze shrink-0" strokeWidth={1.75} />
        {tab === 'types' ? t.tabTypesHelp : t.tabVehiclesHelp}
      </p>

      {/* ── VEHICLES TAB ── */}
      {tab === 'vehicles' && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
          {allVehicles.length === 0 ? (
            <div className="px-6 py-16 text-center space-y-3">
              <p className="text-sm text-sl-on-surface-muted">No hay vehículos registrados.</p>
              <Link href="/admin/fleet/new" className="text-xs text-bronze hover:text-bronze/80 transition-colors">
                Agregar primer vehículo →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20">
                  {['Vehículo', 'Tipo', 'Estado', 'Conductor', ''].map((h) => (
                    <th key={h} className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant/50">
                {allVehicles.map((v) => {
                  const type = v.vehicle_type_id ? typeMap[v.vehicle_type_id] : null
                  return (
                    <tr key={v.id} className="hover:bg-sl-bg/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {type?.base_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={type.base_image_url}
                              alt={type.name}
                              className="h-11 w-16 object-cover rounded-lg border border-sl-outline-variant shrink-0"
                            />
                          ) : (
                            <div className="h-11 w-16 rounded-lg bg-sl-bg border border-sl-outline-variant shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold text-sl-on-surface">
                              {v.year} {v.make} {v.model}
                            </p>
                            <p className="text-xs text-sl-on-surface-muted mt-0.5">
                              {v.plate_number}{v.color ? ` · ${v.color}` : ''}
                            </p>
                            {maintenanceAlert(v.next_maintenance_at, v.insurance_expires_at) && (
                              <span
                                title={t.maintenanceDue}
                                className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
                              >
                                <AlertTriangle size={11} strokeWidth={2.25} />
                                {t.maintenanceDue}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-sl-on-surface-muted">
                          {type?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <VehicleStatusSelect vehicleId={v.id} current={v.status} statuses={t.statuses} saving={t.saving} />
                      </td>
                      <td className="px-6 py-4">
                        <DriverAssignSelect
                          vehicleId={v.id}
                          currentDriverId={v.current_driver_id}
                          drivers={allDrivers}
                          unassigned={t.unassigned}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/fleet/${v.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-bronze border border-bronze/30 rounded-lg hover:bg-bronze/5 hover:border-bronze transition-colors"
                        >
                          Detalles →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ── VEHICLE TYPES TAB ── */}
      {tab === 'types' && (
        <div className="space-y-4">
          {allTypes.length === 0 && (
            <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm px-6 py-12 text-center text-sm text-sl-on-surface-muted">
              Aún no hay tipos de vehículo. Agrega uno a continuación.
            </div>
          )}

          {allTypes.length > 0 && (
            <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/20">
                    {['Tipo', 'Clase', 'Capacidad', 'Amenidades', 'Estado'].map((h) => (
                      <th key={h} className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sl-outline-variant/50">
                  {allTypes.map((vt) => (
                    <VehicleTypeRow key={vt.id} vt={vt} fleet={t} actions={actions} />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          <AddVehicleTypeForm labels={t.typeForm} classes={t.classes} />
        </div>
      )}
    </div>
  )
}
