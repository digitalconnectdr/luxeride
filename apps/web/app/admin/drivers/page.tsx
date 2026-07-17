import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { DriverAvailabilityToggle } from '@/components/admin/fleet-controls'
import { getDict } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Conductores' }

export default async function DriversPage() {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'accounting')
  const companyId = user.company_id!
  const admin = createAdminClient()
  const tf = getDict().admin.fleet

  // ── Queries separadas con manejo individual de errores ─────────────────────
  // Usamos bloques try/catch independientes en lugar de Promise.all para:
  //   1. Aislar fallos (si una query lanza, la otra sigue)
  //   2. Exponer el error real en Vercel Function Logs
  //   3. Evitar que el componente crashee si la tabla aún no existe en producción

  const profilesQuery = admin
    .from('user_profiles')
    .select('id, first_name, last_name, phone, is_active')
    .eq('company_id', companyId)
    .eq('role', 'driver')
    .order('first_name', { ascending: true })

  const driversQuery = admin
    .from('drivers')
    .select('id, license_number, license_expiry, license_state, current_vehicle_id, is_available, rating, total_trips')
    .eq('company_id', companyId)

  const vehiclesQuery = admin
    .from('vehicles')
    .select('id, plate_number, vehicle_type_id')
    .eq('company_id', companyId)

  const vehicleTypesQuery = admin
    .from('vehicle_types')
    .select('id, name')
    .eq('company_id', companyId)

  type ProfileData = Awaited<typeof profilesQuery>['data']
  type DriverData  = Awaited<typeof driversQuery>['data']

  let profilesData: ProfileData = null
  let driversData:  DriverData  = null

  try {
    const { data, error } = await profilesQuery
    if (error) {
      console.error('[drivers/page] user_profiles query error:', JSON.stringify(error))
    }
    profilesData = data
  } catch (err) {
    console.error('[drivers/page] user_profiles query THREW:', err)
  }

  try {
    const { data, error } = await driversQuery
    if (error) {
      console.error('[drivers/page] drivers query error:', JSON.stringify(error))
    }
    driversData = data
  } catch (err) {
    console.error('[drivers/page] drivers query THREW:', err)
  }

  // Vehículo con el que cada conductor está trabajando HOY (drivers.current_vehicle_id) —
  // un conductor puede tener varios vehículos disponibles pero solo uno asignado a la vez.
  let vehiclesData: { id: string; plate_number: string; vehicle_type_id: string | null }[] = []
  let vehicleTypesData: { id: string; name: string }[] = []
  try {
    const { data, error } = await vehiclesQuery
    if (error) console.error('[drivers/page] vehicles query error:', JSON.stringify(error))
    vehiclesData = data ?? []
  } catch (err) {
    console.error('[drivers/page] vehicles query THREW:', err)
  }
  try {
    const { data, error } = await vehicleTypesQuery
    if (error) console.error('[drivers/page] vehicle_types query error:', JSON.stringify(error))
    vehicleTypesData = data ?? []
  } catch (err) {
    console.error('[drivers/page] vehicle_types query THREW:', err)
  }
  const vehicleTypeNameById = Object.fromEntries(vehicleTypesData.map((vt) => [vt.id, vt.name]))
  const vehicleById = Object.fromEntries(vehiclesData.map((v) => [v.id, v]))

  // Conteo de viajes COMPLETADOS por conductor (dinámico = siempre correcto,
  // no depende de incrementar drivers.total_trips al completar).
  const tripCounts: Record<string, number> = {}
  try {
    const { data } = await admin
      .from('bookings')
      .select('driver_id')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .not('driver_id', 'is', null)
    for (const b of data ?? []) {
      if (b.driver_id) tripCounts[b.driver_id] = (tripCounts[b.driver_id] ?? 0) + 1
    }
  } catch (err) {
    console.error('[drivers/page] trips count THREW:', err)
  }

  const allProfiles = profilesData ?? []
  const driverMap   = Object.fromEntries((driversData ?? []).map((d) => [d.id, d]))

  const isAccounting = user.role === 'accounting'
  const today = new Date()

  return (
    <div className="p-8 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">Conductores</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">
            {allProfiles.length} conductor{allProfiles.length !== 1 ? 'es' : ''}
            {' · '}
            {(driversData ?? []).filter((d) => d.is_available).length} disponibles
          </p>
        </div>
        {/* Invitar conductor — disponible en F1.6 (Auth flows) */}
      </div>

      {/* Table */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
        {allProfiles.length === 0 ? (
          <div className="px-6 py-16 text-center space-y-2">
            <p className="text-sm text-sl-on-surface-muted">No hay conductores registrados.</p>
            {/* Invitación disponible en F1.6 */}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20">
                {['Conductor', 'Licencia', 'Vehículo asignado', 'Viajes', 'Rating', 'Disponibilidad', ''].map((h) => (
                  <th key={h} className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {allProfiles.map((p) => {
                const dr = driverMap[p.id]
                const licenseExpiry = dr?.license_expiry ? new Date(dr.license_expiry) : null
                const licenseExpired  = licenseExpiry ? licenseExpiry < today : false
                const licenseExpiring = licenseExpiry
                  ? !licenseExpired && licenseExpiry < new Date(today.getTime() + 30 * 86_400_000)
                  : false

                return (
                  <tr key={p.id} className="hover:bg-sl-bg/40 transition-colors group">
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-bronze">
                            {p.first_name?.[0]}{p.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sl-on-surface">
                            {p.first_name} {p.last_name}
                          </p>
                          {p.phone && (
                            <p className="text-xs text-sl-on-surface-muted">{p.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* License */}
                    <td className="px-6 py-4">
                      {dr ? (
                        <div>
                          <p className="text-xs text-sl-on-surface">
                            {dr.license_number ?? '—'}
                            {dr.license_state ? ` · ${dr.license_state}` : ''}
                          </p>
                          {licenseExpiry && (
                            <p className={`text-[10px] mt-0.5 ${licenseExpired ? 'text-red-400' : licenseExpiring ? 'text-amber-400' : 'text-sl-on-surface-muted'}`}>
                              {licenseExpired ? '⚠ Vencida' : licenseExpiring ? '⚠ Vence pronto' : ''}
                              {' '}{licenseExpiry.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-sl-on-surface-muted">Sin registro</span>
                      )}
                    </td>

                    {/* Vehículo asignado hoy — un conductor puede tener varios vehículos
                        disponibles pero solo uno current_vehicle_id a la vez. */}
                    <td className="px-6 py-4">
                      {(() => {
                        const v = dr?.current_vehicle_id ? vehicleById[dr.current_vehicle_id] : null
                        if (!v) return <span className="text-xs text-sl-on-surface-muted">Sin asignar</span>
                        return (
                          <div>
                            <p className="text-xs text-sl-on-surface">{(v.vehicle_type_id && vehicleTypeNameById[v.vehicle_type_id]) ?? '—'}</p>
                            <p className="text-[10px] text-sl-on-surface-muted mt-0.5">{v.plate_number}</p>
                          </div>
                        )
                      })()}
                    </td>

                    {/* Trips — conteo dinámico de viajes completados */}
                    <td className="px-6 py-4">
                      <span className="text-xs text-sl-on-surface-muted">
                        {tripCounts[p.id] ?? 0}
                      </span>
                    </td>

                    {/* Rating */}
                    <td className="px-6 py-4">
                      {dr?.rating != null ? (
                        <span className="text-xs text-bronze font-medium">
                          ★ {Number(dr.rating).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-sl-on-surface-muted">—</span>
                      )}
                    </td>

                    {/* Availability toggle */}
                    <td className="px-6 py-4">
                      {dr && !isAccounting ? (
                        <DriverAvailabilityToggle
                          driverId={dr.id}
                          isAvailable={dr.is_available}
                          labels={tf.availability}
                          saving={tf.saving}
                        />
                      ) : (
                        <span className={`text-xs ${dr?.is_available ? 'text-green-400' : 'text-sl-on-surface-muted'}`}>
                          {dr?.is_available ? 'Disponible' : 'No disponible'}
                        </span>
                      )}
                    </td>

                    {/* Link */}
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/drivers/${p.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-bronze border border-bronze/30 rounded-lg hover:bg-bronze/5 hover:border-bronze transition-colors"
                      >
                        Perfil →
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
    </div>
  )
}
