'use server'
// ── Tracking GPS en vivo (conductor↔pasajero, solo viaje activo) ──────────────
// El conductor está autenticado (requireRole('driver')); el pasajero NO tiene
// login — el UUID de la reserva actúa como capability URL, igual que el resto
// de las acciones públicas del viaje (trip.ts).

import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { SessionUser } from '@/lib/auth/session'
import { consumeLiveTrackingQuota } from '@/lib/tracking/live-tracking-quota'
import type { LatLng } from '@/lib/tracking/static-map-url'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Estados donde tiene sentido reportar/mostrar posición en vivo.
const ACTIVE_TRIP_STATUSES = new Set(['assigned', 'en_route', 'arrived', 'in_progress'])

// ─── Reportar posición (conductor) ─────────────────────────────────────────────
// Núcleo compartido: recibe un SessionUser ya resuelto (por cookie en la web,
// por bearer token en la app móvil — ver app/api/mobile/driver/report-location).

export async function reportDriverLocation(
  user: SessionUser,
  bookingId: string,
  lat: number,
  lng: number,
): Promise<{ success: boolean; error?: string }> {
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

export async function reportDriverLocationAction(
  bookingId: string,
  lat: number,
  lng: number,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  return reportDriverLocation(user, bookingId, lat, lng)
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

// ─── Posiciones en vivo (mapa interactivo) ─────────────────────────────────────
// Lectura pura de Supabase — NO llama a ninguna API de Google, así que NO
// consume la cuota mensual del plan. El mapa JS (InteractiveLiveMap) sondea
// esto cada ~15s solo para reposicionar sus propios marcadores; el costo real
// de Google (un "map load" de la API JS) ya se contabilizó una única vez al
// activar la sesión — ver activateLiveMapSessionAction más abajo.

export interface LiveTripPositions {
  driverPos: LatLng | null
  passengerPos: LatLng | null
  // Hora del último ping de GPS del conductor — el cliente la usa para decidir
  // si mostrar el aviso de "vista en pausa" (independiente de si Realtime
  // entregó o no el evento: el pasajero navega sin sesión y las políticas de
  // seguridad no le dan acceso a los eventos de Realtime de trip_locations,
  // así que la señal de "¿sigue llegando GPS?" tiene que venir de aquí).
  driverRecordedAt: string | null
}

export async function getLiveTripPositionsAction(bookingId: string): Promise<LiveTripPositions | null> {
  if (!UUID_RE.test(bookingId)) return null

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single()
  if (!booking || !ACTIVE_TRIP_STATUSES.has(booking.status)) return null

  const [{ data: latestDriver }, { data: latestPassenger }] = await Promise.all([
    admin.from('trip_locations').select('latitude, longitude, recorded_at').eq('booking_id', bookingId).eq('reporter', 'driver').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('trip_locations').select('latitude, longitude').eq('booking_id', bookingId).eq('reporter', 'passenger').order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  return {
    driverPos: latestDriver ? { lat: latestDriver.latitude, lng: latestDriver.longitude } : null,
    passengerPos: latestPassenger ? { lat: latestPassenger.latitude, lng: latestPassenger.longitude } : null,
    driverRecordedAt: latestDriver?.recorded_at ?? null,
  }
}

// ─── Activar sesión de mapa en vivo (consume 1 unidad de cuota) ───────────────
// Se llama UNA sola vez, al montar el mapa interactivo en el navegador (no en
// cada sondeo de posición) — un "map load" de la API JS de Google se cobra por
// sesión de mapa, no por cada vez que se reposiciona un marcador. Si la cuota
// mensual del plan ya se agotó, el llamador debe mostrar el mapa estático
// congelado (última posición conocida, sin refresco) en su lugar — degradación
// amable, nunca se bloquea la página.

export async function activateLiveMapSessionAction(bookingId: string): Promise<{ allowed: boolean } | null> {
  if (!UUID_RE.test(bookingId)) return null

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id')
    .eq('id', bookingId)
    .single()
  if (!booking || !ACTIVE_TRIP_STATUSES.has(booking.status)) return null

  const allowed = await consumeLiveTrackingQuota(booking.company_id, bookingId)
  return { allowed }
}
