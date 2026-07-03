import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { VehicleStatusSelect, DriverAssignSelect } from '@/components/admin/fleet-controls'
import { VehicleTypeRow } from '@/components/admin/vehicle-type-row'
import { AddVehicleTypeForm } from '@/components/admin/add-vehicle-type-form'
import { getDict } from '@/lib/i18n/server'
import type { VehicleStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Fleet' }

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
      .select('id, make, model, year, plate_number, status, color, vehicle_type_id, current_driver_id, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    admin
      .from('vehicle_types')
      .select('id, name, class, capacity, amenities, is_active, base_image_url')
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
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.title}</h1>
          <p className="text-sm text-sl-on-surface-muted mt-1">
            {allVehicles.length} {t.vehicles}
            {' · '}
            {allVehicles.filter((v) => v.status === 'available').length} {t.available}
          </p>
        </div>
        {tab === 'vehicles' && (
          <Link
            href="/admin/fleet/new"
            className="px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 transition-colors"
          >
            {t.addVehicle}
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-sl-surface-high border border-sl-outline-variant rounded-xl p-1 w-fit">
        {tabs.map((tb) => (
          <Link
            key={tb.value}
            href={`/admin/fleet${tb.value !== 'vehicles' ? `?tab=${tb.value}` : ''}`}
            className={[
              'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
              tab === tb.value
                ? 'bg-gold text-gray-900'
                : 'text-sl-on-surface-muted hover:text-sl-on-surface',
            ].join(' ')}
          >
            {tb.label}
          </Link>
        ))}
      </div>

      {/* Aclaración de la pestaña activa (tipos ≠ vehículos) */}
      <p className="flex items-start gap-2 text-xs text-sl-on-surface-muted -mt-2 max-w-2xl">
        <span className="text-bronze shrink-0">ⓘ</span>
        {tab === 'types' ? t.tabTypesHelp : t.tabVehiclesHelp}
      </p>

      {/* ── VEHICLES TAB ── */}
      {tab === 'vehicles' && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
          {allVehicles.length === 0 ? (
            <div className="px-6 py-16 text-center space-y-3">
              <p className="text-sm text-sl-on-surface-muted">No hay vehículos registrados.</p>
              <Link href="/admin/fleet/new" className="text-xs text-bronze hover:text-bronze/80 transition-colors">
                Agregar primer vehículo →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-outline-variant">
                  {['Vehículo', 'Tipo', 'Estado', 'Conductor', ''].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
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
                      <td className="px-5 py-4">
                        <p className="font-medium text-sl-on-surface">
                          {v.year} {v.make} {v.model}
                        </p>
                        <p className="text-xs text-sl-on-surface-muted mt-0.5">
                          {v.plate_number}{v.color ? ` · ${v.color}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-sl-on-surface-muted">
                          {type?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <VehicleStatusSelect vehicleId={v.id} current={v.status} statuses={t.statuses} saving={t.saving} />
                      </td>
                      <td className="px-5 py-4">
                        <DriverAssignSelect
                          vehicleId={v.id}
                          currentDriverId={v.current_driver_id}
                          drivers={allDrivers}
                          unassigned={t.unassigned}
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/fleet/${v.id}`}
                          className="text-xs text-bronze opacity-0 group-hover:opacity-100 hover:text-bronze/80 transition-all"
                        >
                          Detalles →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── VEHICLE TYPES TAB ── */}
      {tab === 'types' && (
        <div className="space-y-4">
          {allTypes.length === 0 && (
            <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl px-6 py-12 text-center text-sm text-sl-on-surface-muted">
              Aún no hay tipos de vehículo. Agrega uno a continuación.
            </div>
          )}

          {allTypes.length > 0 && (
            <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-sl-outline-variant">
                    {['Tipo', 'Clase', 'Capacidad', 'Amenidades', 'Estado'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
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
          )}

          <AddVehicleTypeForm labels={t.typeForm} classes={t.classes} />
        </div>
      )}
    </div>
  )
}
