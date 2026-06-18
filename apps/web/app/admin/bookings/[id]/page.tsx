import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import { BookingActions } from './booking-actions'
import { BookingPayments } from '@/components/admin/booking-payments'
import { isStripeConfigured } from '@/lib/stripe/server'
import type { BookingStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Reservación' }

interface LocationJson {
  address?: string
  lat?: number
  lng?: number
  notes?: string
}

function parseLocation(raw: unknown): LocationJson {
  if (!raw || typeof raw !== 'object') return {}
  return raw as LocationJson
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-DO', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TYPE_LABELS: Record<string, string> = {
  one_way: 'Solo ida', round_trip: 'Ida y vuelta', hourly: 'Por hora',
  airport_pickup: 'Pickup aeropuerto', airport_dropoff: 'Dropoff aeropuerto',
  point_to_point: 'Punto a punto',
}

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await requireRole(
    'super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting',
  )

  if (!user.company_id) return notFound()

  const admin = createAdminClient()
  const companyId = user.company_id

  const { data: booking } = await admin
    .from('bookings')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', companyId)
    .single()

  if (!booking) return notFound()

  // Datos relacionados
  const [{ data: fees }, { data: drivers }, { data: vehicleType }, { data: payments }] = await Promise.all([
    admin
      .from('booking_fees')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at'),
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', companyId)
      .eq('role', 'driver')
      .eq('is_active', true)
      .order('first_name'),
    booking.vehicle_type_id
      ? admin
          .from('vehicle_types')
          .select('id, name, class, capacity')
          .eq('id', booking.vehicle_type_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from('payments')
      .select('id, amount, currency, status, payment_method, description, failure_message, captured_at, created_at')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false }),
  ])

  // Conductor asignado
  let driverName = '—'
  if (booking.driver_id) {
    const { data: driver } = await admin
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', booking.driver_id)
      .single()
    if (driver) driverName = `${driver.first_name} ${driver.last_name}`
  }

  const pickup  = parseLocation(booking.pickup_location)
  const dropoff = parseLocation(booking.dropoff_location)
  const isStaff = user.role !== 'accounting'

  return (
    <div className="p-8 max-w-[1100px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/bookings" className="text-sm text-sl-on-surface-muted hover:text-[#0071e3]">
              ← Reservaciones
            </Link>
          </div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mt-2">
            {booking.booking_number}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <BookingStatusBadge status={booking.status as BookingStatus} size="md" />
            <span className="text-sm text-sl-on-surface-muted">
              {TYPE_LABELS[booking.type] ?? booking.type}
            </span>
          </div>
        </div>
        <p className="text-right text-3xl font-playfair font-semibold text-sl-on-surface">
          {booking.total_amount != null
            ? `$${Number(booking.total_amount).toFixed(2)}`
            : '—'}
          <span className="text-sm font-sans font-normal text-sl-on-surface-muted ml-1">
            {booking.currency ?? 'USD'}
          </span>
        </p>
      </div>

      {/* Acciones de estado + asignación */}
      {isStaff && (
        <BookingActions
          bookingId={booking.id}
          currentStatus={booking.status as BookingStatus}
          driverId={booking.driver_id ?? null}
          drivers={drivers ?? []}
        />
      )}

      {/* Detalles de la ruta */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          Ruta
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-sl-on-surface-muted mb-1">Pickup</p>
            <p className="text-sm font-medium text-sl-on-surface">{pickup.address ?? '—'}</p>
            {pickup.notes && <p className="text-xs text-sl-on-surface-muted mt-0.5">{pickup.notes}</p>}
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted mb-1">Dropoff</p>
            <p className="text-sm font-medium text-sl-on-surface">{dropoff.address ?? '—'}</p>
            {dropoff.notes && <p className="text-xs text-sl-on-surface-muted mt-0.5">{dropoff.notes}</p>}
          </div>
        </div>
        {Array.isArray(booking.waypoints) && booking.waypoints.length > 0 && (
          <div className="pt-2 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted mb-1">
              Paradas intermedias ({booking.waypoints.length})
            </p>
            {booking.waypoints.map((w, i) => {
              const stop = parseLocation(w)
              return (
                <p key={i} className="text-sm text-sl-on-surface">
                  <span className="text-bronze font-medium">{i + 1}.</span> {stop.address ?? '—'}
                </p>
              )
            })}
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-sl-outline-variant">
          <div>
            <p className="text-xs text-sl-on-surface-muted">Fecha / Hora</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{fmt(booking.scheduled_at)}</p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">Distancia</p>
            <p className="text-sm text-sl-on-surface mt-0.5">
              {booking.distance_miles != null ? `${Number(booking.distance_miles).toFixed(1)} mi` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">Duración est.</p>
            <p className="text-sm text-sl-on-surface mt-0.5">
              {booking.duration_minutes != null ? `${booking.duration_minutes} min` : '—'}
            </p>
          </div>
        </div>
        {booking.flight_number && (
          <div className="pt-2 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted">Vuelo</p>
            <p className="text-sm font-mono text-sl-on-surface mt-0.5">
              ✈ {booking.flight_number}
              {booking.flight_status === 'cancelled' && (
                <span className="ml-2 font-sans font-semibold text-red-500">CANCELADO</span>
              )}
              {booking.flight_status !== 'cancelled' && (booking.flight_delay_minutes ?? 0) >= 15 && (
                <span className="ml-2 font-sans font-semibold text-orange-500">
                  +{booking.flight_delay_minutes} min de retraso
                </span>
              )}
              {booking.flight_status === 'arrived' && (
                <span className="ml-2 font-sans text-green-600">aterrizó</span>
              )}
              {booking.flight_status === 'enroute' && (
                <span className="ml-2 font-sans text-sl-on-surface-muted">en vuelo</span>
              )}
            </p>
            {booking.flight_arrival_at && (
              <p className="text-xs text-sl-on-surface-muted mt-1">
                Llegada estimada: {fmt(booking.flight_arrival_at)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pasajero */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          Pasajero
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-sl-on-surface-muted">Nombre</p>
            <p className="text-sm font-medium text-sl-on-surface mt-0.5">{booking.passenger_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">Pasajeros</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{booking.passenger_count}</p>
          </div>
          {booking.passenger_phone && (
            <div>
              <p className="text-xs text-sl-on-surface-muted">Teléfono</p>
              <p className="text-sm text-sl-on-surface mt-0.5">{booking.passenger_phone}</p>
            </div>
          )}
          {booking.passenger_email && (
            <div>
              <p className="text-xs text-sl-on-surface-muted">Email</p>
              <p className="text-sm text-sl-on-surface mt-0.5">{booking.passenger_email}</p>
            </div>
          )}
        </div>
        {booking.special_instructions && (
          <div className="pt-3 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted mb-1">Instrucciones especiales</p>
            <p className="text-sm text-sl-on-surface">{booking.special_instructions}</p>
          </div>
        )}
      </div>

      {/* Vehículo + conductor */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          Vehículo y conductor
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-sl-on-surface-muted">Tipo de vehículo</p>
            <p className="text-sm text-sl-on-surface mt-0.5">
              {vehicleType ? `${vehicleType.name} (${vehicleType.capacity} pax)` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">Conductor</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{driverName}</p>
          </div>
        </div>
      </div>

      {/* Fees */}
      {fees && fees.length > 0 && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
            Desglose de cargos
          </p>
          <div className="space-y-2">
            {fees.map((fee) => (
              <div key={fee.id} className="flex justify-between text-sm">
                <span className="text-sl-on-surface-muted capitalize">
                  {fee.description ?? fee.type}
                </span>
                <span className="text-sl-on-surface font-medium">
                  ${Number(fee.amount).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-sl-outline-variant pt-2 mt-2">
              <span className="text-sl-on-surface">Total</span>
              <span className="text-sl-on-surface">
                ${Number(booking.total_amount ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Pagos */}
      <BookingPayments
        bookingId={booking.id}
        payments={payments ?? []}
        stripeConfigured={isStripeConfigured()}
        canRefund={['company_owner', 'company_admin', 'accounting'].includes(user.role)}
        bookingTotal={booking.total_amount}
      />

      {/* Timestamps */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
          Historial de tiempos
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Creada',     value: booking.created_at },
            { label: 'Asignada',   value: booking.dispatched_at },
            { label: 'En ruta',    value: booking.en_route_at },
            { label: 'Llegó',      value: booking.arrived_at },
            { label: 'Iniciada',   value: booking.started_at },
            { label: 'Completada', value: booking.completed_at },
            { label: 'Cancelada',  value: booking.cancelled_at },
            { label: 'No show',    value: booking.no_show_at },
          ].filter((t) => t.value).map((t) => (
            <div key={t.label}>
              <p className="text-xs text-sl-on-surface-muted">{t.label}</p>
              <p className="text-sl-on-surface">{fmt(t.value ?? null)}</p>
            </div>
          ))}
        </div>
        {booking.cancellation_reason && (
          <div className="mt-3 pt-3 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted">Razón de cancelación</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{booking.cancellation_reason}</p>
          </div>
        )}
      </div>

      {/* Notas internas */}
      {booking.internal_notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-700 mb-2">
            Notas internas (solo staff)
          </p>
          <p className="text-sm text-yellow-800">{booking.internal_notes}</p>
        </div>
      )}

    </div>
  )
}
