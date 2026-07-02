'use server'
// ── Tracking GPS en vivo (conductor↔pasajero, solo viaje activo) ──────────────
// El conductor está autenticado (requireRole('driver')); el pasajero NO tiene
// login — el UUID de la reserva actúa como capability URL, igual que el resto
// de las acciones públicas del viaje (trip.ts).

import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { consumeLiveTrackingQuota } from '@/lib/tracking/live-tracking-quota'
import { buildTripStaticMapUrl, type LatLng } from '@/lib/tracking/static-map-url'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Estados donde tiene sentido reportar/mostrar posición en vivo.
const ACTIVE_TRIP_STATUSES = new Set(['assigned', 'en_route', 'arrived', 'in_progress'])

// ─── Reportar posición (conductor) ─────────────────────────────────────────────

export async function reportDriverLocationAction(
  bookingId: string,
  lat: number,
  lng: number,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { success: false, error: 'Ubicación inválida' }
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .eq('driver_id', user.id)
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado' }
  if (!ACTIVE_TRIP_STATUSES.has(booking.status)) return { success: false, error: 'El viaje no está activo' }

  const { error } = await admin.from('trip_locations').insert({
    booking_id: bookingId,
    company_id: booking.company_id,
    reporter: 'driver',
    latitude: lat,
    longitude: lng,
  })
  if (error) return { success: false, error: 'Error al guardar ubicación' }
  return { success: true }
}

// ─── Reportar posición (pasajero, opt-in explícito) ────────────────────────────

export async function reportPassengerLocationAction(
  bookingId: string,
  lat: number,
  lng: number,
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { success: false, error: 'Ubicación inválida' }
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id')
    .eq('id', bookingId)
    .single()

  if (!booking) return { success: false, error: 'Reserva no encontrada' }
  if (!ACTIVE_TRIP_STATUSES.has(booking.status)) return { success: false, error: 'El viaje no está activo' }

  const { error } = await admin.from('trip_locations').insert({
    booking_id: bookingId,
    company_id: booking.company_id,
    reporter: 'passenger',
    latitude: lat,
    longitude: lng,
  })
  if (error) return { success: false, error: 'Error al guardar ubicación' }
  return { success: true }
}

// ─── Refrescar el mapa en vivo (pasajero o conductor viendo el mismo viaje) ────
// Único punto donde se consulta/consume la cuota mensual del plan — así el
// costo de Google Maps queda topado sin importar cuánto crezca un operador.

export interface LiveMapRefresh {
  url: string
  driverPos: LatLng | null
  passengerPos: LatLng | null
  quotaExceeded: boolean
}

export async function refreshLiveMapAction(bookingId: string): Promise<LiveMapRefresh | null> {
  if (!UUID_RE.test(bookingId)) return null

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, pickup_location, dropoff_location')
    .eq('id', bookingId)
    .single()
  if (!booking || !ACTIVE_TRIP_STATUSES.has(booking.status)) return null

  const pLoc = booking.pickup_location as { lat?: number; lng?: number } | null
  const dLoc = booking.dropoff_location as { lat?: number; lng?: number } | null
  if (typeof pLoc?.lat !== 'number' || typeof pLoc?.lng !== 'number' || typeof dLoc?.lat !== 'number' || typeof dLoc?.lng !== 'number') {
    return null
  }

  const [{ data: company }, { data: latestDriver }, { data: latestPassenger }] = await Promise.all([
    admin.from('companies').select('primary_color').eq('id', booking.company_id).single(),
    admin.from('trip_locations').select('latitude, longitude').eq('booking_id', bookingId).eq('reporter', 'driver').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('trip_locations').select('latitude, longitude').eq('booking_id', bookingId).eq('reporter', 'passenger').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const brandColor = (company?.primary_color as string | null) ?? '#c9a24b'
  const driverPos: LatLng | null = latestDriver ? { lat: latestDriver.latitude, lng: latestDriver.longitude } : null
  const passengerPos: LatLng | null = latestPassenger ? { lat: latestPassenger.latitude, lng: latestPassenger.longitude } : null

  if (!mapsKey) return null

  const allowed = await consumeLiveTrackingQuota(booking.company_id)
  const url = buildTripStaticMapUrl({
    pickup: { lat: pLoc.lat, lng: pLoc.lng },
    dropoff: { lat: dLoc.lat, lng: dLoc.lng },
    brandColor,
    mapsKey,
    // Sin cuota disponible: se sigue mostrando el mapa (ruta A→B), pero sin
    // los marcadores en vivo — degradación amable, nunca se bloquea la página.
    driverPos: allowed ? driverPos : null,
    passengerPos: allowed ? passengerPos : null,
  })

  return { url, driverPos, passengerPos, quotaExceeded: !allowed }
}
