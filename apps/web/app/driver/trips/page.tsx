import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import { DriverTripActions } from '@/components/driver/trip-actions'
import { DriverAddStop } from '@/components/driver/driver-add-stop'
import { TripChat } from '@/components/trip/trip-chat'
import type { BookingStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Mis Viajes | LuxeRide' }
export const dynamic = 'force-dynamic'

// Vista web básica para conductores. La app móvil (Phase 2) la reemplazará.
export default async function DriverTripsPage() {
  const user = await requireRole('driver')

  const admin = createAdminClient()
  const { data: trips } = await admin
    .from('bookings')
    .select('id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, waypoints')
    .eq('driver_id', user.id)
    .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
    .order('scheduled_at')

  return (
    <div className="min-h-screen bg-sl-bg">
      <header className="bg-sl-surface-high border-b border-sl-outline-variant">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center">
              <span className="text-gray-900 font-bold text-[10px] leading-none">L</span>
            </div>
            <span className="font-playfair text-sm font-semibold text-sl-on-surface">Mis viajes</span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-sl-on-surface-muted hover:text-red-400">
              Sign out →
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        <p className="text-sm text-sl-on-surface-muted">
          Hola {user.profile.first_name} — estos son tus viajes asignados.
        </p>

        {!trips?.length ? (
          <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-10 text-center">
            <p className="text-sm text-sl-on-surface-muted">No tienes viajes asignados ahora.</p>
          </div>
        ) : (
          trips.map((t) => {
            const pickup  = (t.pickup_location as { address?: string } | null)?.address ?? '—'
            const dropoff = (t.dropoff_location as { address?: string } | null)?.address ?? '—'
            return (
              <div key={t.id} className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#0071e3]">{t.booking_number}</span>
                  <BookingStatusBadge status={t.status as BookingStatus} />
                </div>
                <p className="text-sm font-semibold text-sl-on-surface">
                  {new Date(t.scheduled_at).toLocaleString('es-DO', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                <div className="text-sm space-y-1">
                  <p className="text-sl-on-surface-muted">▲ {pickup}</p>
                  {Array.isArray(t.waypoints) && t.waypoints.map((w, i) => {
                    const addr = (w as { address?: string } | null)?.address
                    if (!addr) return null
                    return <p key={i} className="text-gold">◆ Parada {i + 1}: {addr}</p>
                  })}
                  <p className="text-sl-on-surface-muted">▼ {dropoff}</p>
                </div>
                <div className="text-sm pt-2 border-t border-sl-outline-variant flex items-center justify-between">
                  <span className="text-sl-on-surface">{t.passenger_name ?? 'Pasajero'}</span>
                  {t.passenger_phone && (
                    <a href={`tel:${t.passenger_phone}`} className="text-[#0071e3] text-xs hover:underline">
                      📞 {t.passenger_phone}
                    </a>
                  )}
                </div>
                <DriverTripActions bookingId={t.id} status={t.status} />

                <DriverAddStop bookingId={t.id} />

                <TripChat
                  bookingId={t.id}
                  side="driver"
                  brandColor="#e9c176"
                  labels={{
                    title: 'Chat con el pasajero',
                    subtitle: 'Coordina recogida, retrasos o cambios.',
                    placeholder: 'Escribe un mensaje…',
                    send: 'Enviar',
                    empty: 'Sin mensajes todavía.',
                    you: 'Tú',
                    them: t.passenger_name ?? 'Pasajero',
                  }}
                />
              </div>
            )
          })
        )}

        <p className="text-xs text-center text-sl-on-surface-muted pt-4">
          La app móvil para conductores llega en la Fase 2.
        </p>
      </main>
    </div>
  )
}
