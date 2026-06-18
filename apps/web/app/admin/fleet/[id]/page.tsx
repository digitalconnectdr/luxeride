import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { VehicleStatusSelect, DriverAssignSelect } from '@/components/admin/fleet-controls'
import type { VehicleStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Vehículo' }

const STATUS_BADGE: Record<VehicleStatus, { label: string; cls: string }> = {
  available:   { label: 'Disponible',    cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  on_trip:     { label: 'En servicio',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  maintenance: { label: 'Mantenimiento', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  offline:     { label: 'Fuera de línea',cls: 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40' },
  retired:     { label: 'Retirado',      cls: 'bg-sl-outline-variant/10 text-sl-on-surface-muted border-sl-outline-variant/20' },
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
      notes, created_at
    `)
    .eq('id', params.id)
    .eq('company_id', companyId)       // IDOR guard
    .single()

  if (!vehicle) notFound()

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

  const badge = STATUS_BADGE[vehicle.status]
  const isAccounting = user.role === 'accounting'

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <nav className="text-xs text-sl-on-surface-muted mb-2">
          <Link href="/admin/fleet" className="hover:text-sl-on-surface transition-colors">Fleet</Link>
          <span className="mx-1.5">›</span>
          <span className="text-sl-on-surface">{vehicle.year} {vehicle.make} {vehicle.model}</span>
        </nav>
        <div className="flex items-center gap-4">
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          {vehicle.plate_number}{vehicle.color ? ` · ${vehicle.color}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Status & Driver management ── */}
        {!isAccounting && (
          <div className="lg:col-span-2 space-y-4">

            {/* Status */}
            <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">Estado</p>
              <VehicleStatusSelect vehicleId={vehicle.id} current={vehicle.status} />
            </div>

            {/* Driver assignment */}
            <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                Conductor Asignado
              </p>
              <DriverAssignSelect
                vehicleId={vehicle.id}
                currentDriverId={vehicle.current_driver_id}
                drivers={drivers ?? []}
              />
              {vehicle.current_driver_id && (
                <Link
                  href={`/admin/drivers/${vehicle.current_driver_id}`}
                  className="text-xs text-bronze hover:text-bronze/80 transition-colors"
                >
                  Ver perfil del conductor →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Vehicle info card ── */}
        <div className={isAccounting ? 'lg:col-span-3' : ''}>
          <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3 h-full">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              Información del Vehículo
            </p>
            <dl className="space-y-2.5">
              {[
                { label: 'Tipo',      value: vehicleType?.name ?? '—' },
                { label: 'Clase',     value: vehicleType?.class ? vehicleType.class.charAt(0).toUpperCase() + vehicleType.class.slice(1) : '—' },
                { label: 'Capacidad', value: vehicleType?.capacity ? `${vehicleType.capacity} pasajeros` : '—' },
                { label: 'VIN',       value: vehicle.vin ?? '—' },
                { label: 'Kilometraje', value: vehicle.mileage ? `${vehicle.mileage.toLocaleString('es-MX')} km` : '—' },
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
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-4">
          Mantenimiento y Seguro
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Último mantenimiento', value: formatDate(vehicle.last_maintenance_at) },
            { label: 'Próximo mantenimiento', value: formatDate(vehicle.next_maintenance_at),
              warn: vehicle.next_maintenance_at ? new Date(vehicle.next_maintenance_at) < new Date() : false },
            { label: 'Seguro vence', value: formatDate(vehicle.insurance_expires_at),
              warn: vehicle.insurance_expires_at ? new Date(vehicle.insurance_expires_at) < new Date() : false },
          ].map(({ label, value, warn }) => (
            <div key={label} className="space-y-1">
              <p className="text-xs text-sl-on-surface-muted">{label}</p>
              <p className={`text-sm font-medium ${warn ? 'text-red-400' : 'text-sl-on-surface'}`}>{value}</p>
              {warn && <p className="text-[10px] text-red-400">⚠ Vencido</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Notes ── */}
      {vehicle.notes && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">Notas</p>
          <p className="text-sm text-sl-on-surface whitespace-pre-line">{vehicle.notes}</p>
        </div>
      )}

      {/* ── Footer meta ── */}
      <p className="text-xs text-sl-on-surface-muted">
        Registrado el {formatDate(vehicle.created_at)}
      </p>
    </div>
  )
}
