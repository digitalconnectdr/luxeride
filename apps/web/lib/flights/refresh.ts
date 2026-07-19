// ── Refresco de estado de vuelos en bookings ──────────────────────────────────
// Sin cron (Vercel Hobby limita crons a 1/día): se refresca al cargar el
// dispatch board, con throttle de 30 min por booking vía flight_checked_at.

import { createAdminClient } from '@/lib/supabase/server'
import { getFlightStatus, isFlightTrackingConfigured } from './index'
import { consumeFlightTrackingQuota } from './quota'

const STALE_AFTER_MS = 30 * 60_000
const MAX_LOOKUPS_PER_CALL = 5 // protege el tier gratis de RapidAPI

interface FlightBookingRow {
  id: string
  flight_number: string | null
  flight_checked_at: string | null
  status: string
}

/**
 * Refresca el estado del vuelo de los bookings con datos viejos (>30 min),
 * todos de UNA misma empresa (`companyId`). Devuelve los ids actualizados.
 * NUNCA lanza.
 */
export async function refreshFlightsForBookings(
  companyId: string,
  bookings: FlightBookingRow[],
): Promise<Set<string>> {
  const updated = new Set<string>()
  if (!isFlightTrackingConfigured()) return updated

  const now = Date.now()
  const candidates = bookings
    .filter(
      (b) =>
        b.flight_number &&
        ['pending', 'assigned', 'en_route'].includes(b.status) &&
        (!b.flight_checked_at ||
          now - new Date(b.flight_checked_at).getTime() > STALE_AFTER_MS),
    )
    .slice(0, MAX_LOOKUPS_PER_CALL)

  if (candidates.length === 0) return updated

  const admin = createAdminClient()

  await Promise.allSettled(
    candidates.map(async (b) => {
      const withinQuota = await consumeFlightTrackingQuota(companyId)
      if (!withinQuota) return // cuota agotada este mes -- se reintenta el próximo mes

      const flight = await getFlightStatus(b.flight_number!)
      const patch: {
        flight_checked_at: string
        flight_status?: string | null
        flight_delay_minutes?: number | null
        flight_arrival_at?: string | null
      } = { flight_checked_at: new Date().toISOString() }

      if (flight) {
        patch.flight_status = flight.status
        patch.flight_delay_minutes = flight.delayMinutes
        patch.flight_arrival_at = flight.estimatedArrival
      }

      const { error } = await admin.from('bookings').update(patch).eq('id', b.id)
      if (!error) updated.add(b.id)
    }),
  )

  return updated
}

/**
 * Consulta y guarda el vuelo de UN booking (fire-and-forget al crear la
 * reservación de aeropuerto). NUNCA lanza.
 */
export async function trackBookingFlight(companyId: string, bookingId: string, flightNumber: string): Promise<void> {
  try {
    if (!isFlightTrackingConfigured()) return
    const withinQuota = await consumeFlightTrackingQuota(companyId)
    if (!withinQuota) return // cuota agotada este mes

    const flight = await getFlightStatus(flightNumber)
    if (!flight) return

    const admin = createAdminClient()
    await admin
      .from('bookings')
      .update({
        flight_status: flight.status,
        flight_delay_minutes: flight.delayMinutes,
        flight_arrival_at: flight.estimatedArrival,
        flight_checked_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
  } catch (err) {
    console.error('[trackBookingFlight]', err)
  }
}
