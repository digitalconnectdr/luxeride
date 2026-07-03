import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { refreshFlightsForBookings } from '@/lib/flights/refresh'
import { DispatchBoard } from '@/components/dispatcher/dispatch-board'

export const metadata: Metadata = { title: 'Dispatch' }
export const dynamic = 'force-dynamic'

export default async function DispatcherDashboardPage() {
  const user = await requireRole('dispatcher', 'company_owner', 'company_admin', 'super_admin')

  if (!user.company_id) {
    return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>
  }

  const admin = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [{ data: initialRows }, { data: drivers }] = await Promise.all([
    admin
      .from('bookings')
      .select('id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, waypoints, total_amount, currency, driver_id, vehicle_type_id, flight_number, flight_status, flight_delay_minutes, flight_checked_at')
      .eq('company_id', user.company_id)
      .or(
        // Activos (cualquier fecha) + finalizados de hoy. Se usa el timestamp
        // terminal real de cada estado (completed_at/cancelled_at/no_show_at),
        // NUNCA updated_at: cualquier edición posterior (p.ej. el cliente
        // califica un viaje completado hace semanas) también actualiza
        // updated_at, y eso hacía "reaparecer" viajes viejos en el board de hoy.
        `status.in.(pending,assigned,en_route,arrived,in_progress),` +
          `and(status.eq.completed,completed_at.gte.${todayStart.toISOString()}),` +
          `and(status.eq.cancelled,cancelled_at.gte.${todayStart.toISOString()}),` +
          `and(status.eq.no_show,no_show_at.gte.${todayStart.toISOString()})`,
      )
      .order('scheduled_at')
      .limit(100),
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', user.company_id)
      .eq('role', 'driver')
      .eq('is_active', true)
      .order('first_name'),
  ])

  // Conteo de eventos recientes (24h) por reserva — rechazos/incidentes/
  // reasignaciones, para mostrar un aviso en el tablero sin abrir cada viaje.
  const eventsSince = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const { data: recentEvents } = await admin
    .from('booking_events')
    .select('booking_id, type')
    .eq('company_id', user.company_id)
    .gte('created_at', eventsSince)
  const eventCounts = new Map<string, number>()
  for (const ev of recentEvents ?? []) {
    eventCounts.set(ev.booking_id, (eventCounts.get(ev.booking_id) ?? 0) + 1)
  }

  // Flight tracking: refrescar vuelos con datos viejos (>30 min, máx. 5 por carga)
  let bookings = initialRows ?? []
  const refreshed = await refreshFlightsForBookings(bookings)
  if (refreshed.size > 0) {
    const { data: freshRows } = await admin
      .from('bookings')
      .select('id, flight_status, flight_delay_minutes, flight_number')
      .in('id', [...refreshed])
    const freshById = new Map((freshRows ?? []).map((r) => [r.id, r]))
    bookings = bookings.map((b) => {
      const fresh = freshById.get(b.id)
      return fresh
        ? { ...b, flight_status: fresh.flight_status, flight_delay_minutes: fresh.flight_delay_minutes }
        : b
    })
  }

  return (
    <DispatchBoard
      companyId={user.company_id}
      initialBookings={bookings.map((b) => ({
        id: b.id,
        booking_number: b.booking_number,
        status: b.status,
        passenger_name: b.passenger_name,
        passenger_phone: b.passenger_phone,
        scheduled_at: b.scheduled_at,
        pickup_address: (b.pickup_location as { address?: string } | null)?.address ?? '',
        dropoff_address: (b.dropoff_location as { address?: string } | null)?.address ?? '',
        total_amount: b.total_amount,
        currency: b.currency ?? 'USD',
        driver_id: b.driver_id,
        flight_number: b.flight_number,
        flight_status: b.flight_status,
        flight_delay_minutes: b.flight_delay_minutes,
        stops_count: Array.isArray(b.waypoints) ? b.waypoints.length : 0,
        events_count: eventCounts.get(b.id) ?? 0,
      }))}
      drivers={drivers ?? []}
    />
  )
}
