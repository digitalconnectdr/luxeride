import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import type { BookingStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Reservaciones' }

const ALL_STATUSES: BookingStatus[] = [
  'pending', 'assigned', 'en_route', 'arrived', 'in_progress',
  'completed', 'cancelled', 'no_show',
]

const STATUS_LABELS: Record<BookingStatus, string> = {
  quote: 'Cotización', pending: 'Pendiente', assigned: 'Asignado',
  en_route: 'En ruta', arrived: 'Llegó', in_progress: 'En viaje',
  completed: 'Completado', cancelled: 'Cancelado', no_show: 'No apareció', failed: 'Fallido',
}

interface LocationJson {
  address?: string
  lat?: number
  lng?: number
}

function shortAddress(loc: unknown): string {
  if (!loc || typeof loc !== 'object') return '—'
  const l = loc as LocationJson
  if (!l.address) return '—'
  // Tomar solo la primera parte (antes de la primera coma)
  return l.address.split(',')[0] ?? l.address
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const user = await requireRole(
    'super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting',
  )

  if (!user.company_id) {
    return (
      <div className="p-8">
        <p className="text-sm text-sl-on-surface-muted">Sin empresa asignada.</p>
      </div>
    )
  }

  const admin      = createAdminClient()
  const companyId  = user.company_id
  const filterStatus = searchParams.status as BookingStatus | undefined

  // Stats por estado
  const { data: allBookings } = await admin
    .from('bookings')
    .select('id, status')
    .eq('company_id', companyId)

  const counts: Record<string, number> = {}
  for (const b of allBookings ?? []) {
    counts[b.status] = (counts[b.status] ?? 0) + 1
  }

  // Lista filtrada
  let query = admin
    .from('bookings')
    .select('id, booking_number, status, type, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, total_amount, currency, vehicle_type_id, driver_id')
    .eq('company_id', companyId)
    .order('scheduled_at', { ascending: false })
    .limit(100)

  if (filterStatus) {
    query = query.eq('status', filterStatus)
  }

  const { data: bookings } = await query

  const totalActive = (counts['pending'] ?? 0) + (counts['assigned'] ?? 0) +
    (counts['en_route'] ?? 0) + (counts['arrived'] ?? 0) + (counts['in_progress'] ?? 0)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Reservaciones</h1>
          <p className="text-sm text-sl-on-surface-muted mt-1">
            {allBookings?.length ?? 0} total · {totalActive} activas
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="px-4 py-2 bg-[#0071e3] text-white text-sm font-medium rounded-xl hover:bg-[#0077ed] transition-colors"
        >
          + Nueva reservación
        </Link>
      </div>

      {/* Stat pills por estado */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/bookings"
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !filterStatus
              ? 'bg-[#1d1d1f] text-white'
              : 'bg-sl-surface-high border border-sl-outline-variant text-sl-on-surface-muted hover:border-[#0071e3]'
          }`}
        >
          Todos ({allBookings?.length ?? 0})
        </Link>
        {ALL_STATUSES.map((s) => (
          counts[s] ? (
            <Link
              key={s}
              href={`/admin/bookings?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filterStatus === s
                  ? 'bg-[#1d1d1f] text-white'
                  : 'bg-sl-surface-high border border-sl-outline-variant text-sl-on-surface-muted hover:border-[#0071e3]'
              }`}
            >
              {STATUS_LABELS[s]} ({counts[s]})
            </Link>
          ) : null
        ))}
      </div>

      {/* Tabla */}
      {!bookings?.length ? (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">
            {filterStatus ? `No hay reservaciones con estado "${STATUS_LABELS[filterStatus]}"` : 'No hay reservaciones aún.'}
          </p>
          <Link
            href="/admin/bookings/new"
            className="mt-4 inline-block text-sm text-[#0071e3] hover:underline"
          >
            Crear primera reservación →
          </Link>
        </div>
      ) : (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Nº</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Pasajero</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Estado</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Fecha / Hora</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Pickup</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Dropoff</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, idx) => (
                <tr
                  key={b.id}
                  className={`border-b border-sl-outline-variant last:border-0 hover:bg-sl-bg/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-sl-bg/20'}`}
                >
                  <td className="px-5 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs text-[#0071e3] hover:underline">
                      {b.booking_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-sl-on-surface">{b.passenger_name ?? '—'}</p>
                    {b.passenger_phone && (
                      <p className="text-[11px] text-sl-on-surface-muted">{b.passenger_phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <BookingStatusBadge status={b.status as BookingStatus} />
                  </td>
                  <td className="px-5 py-3 text-sl-on-surface-muted">
                    {formatDate(b.scheduled_at)}
                  </td>
                  <td className="px-5 py-3 text-sl-on-surface max-w-[180px] truncate">
                    {shortAddress(b.pickup_location)}
                  </td>
                  <td className="px-5 py-3 text-sl-on-surface max-w-[180px] truncate">
                    {shortAddress(b.dropoff_location)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-sl-on-surface">
                    {b.total_amount != null
                      ? `$${Number(b.total_amount).toFixed(2)}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
