'use server'
// ── Mapa en vivo de la flota (Dispatch Board) ──────────────────────────────────
// Un solo mapa estático con: conductores de viajes activos (última posición
// reportada en trip_locations, ya construido para el tracking del pasajero) +
// pines de recogidas pendientes. Reutiliza la MISMA cuota mensual por plan que
// el tracking del pasajero (consumeLiveTrackingQuota) — es otro consumidor de
// Static Maps, así que cuenta contra el mismo tope de costo por empresa.

import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { consumeLiveTrackingQuota } from '@/lib/tracking/live-tracking-quota'
import type { BookingStatus } from '@/lib/supabase/database.types'

const ACTIVE_STATUSES: BookingStatus[] = ['en_route', 'arrived', 'in_progress']

export interface DispatchMapPoint {
  bookingId: string
  bookingNumber: string
  kind: 'driver' | 'pending'
}

export interface DispatchMapRefresh {
  url: string | null
  points: DispatchMapPoint[]
  quotaExceeded: boolean
}

export async function refreshDispatchMapAction(): Promise<DispatchMapRefresh | null> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'super_admin')
  if (!user.company_id) return null

  const admin = createAdminClient()
  const companyId = user.company_id

  const [{ data: activeBookings }, { data: pendingBookings }] = await Promise.all([
    admin
      .from('bookings')
      .select('id, booking_number, driver_id')
      .eq('company_id', companyId)
      .in('status', ACTIVE_STATUSES),
    admin
      .from('bookings')
      .select('id, booking_number, pickup_location')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .limit(20),
  ])

  const activeBookingIds = (activeBookings ?? []).map((b) => b.id)
  const driverPosByBooking = new Map<string, { lat: number; lng: number }>()
  if (activeBookingIds.length) {
    const { data: locs } = await admin
      .from('trip_locations')
      .select('booking_id, latitude, longitude, recorded_at')
      .in('booking_id', activeBookingIds)
      .eq('reporter', 'driver')
      .order('recorded_at', { ascending: false })
    for (const loc of locs ?? []) {
      if (!driverPosByBooking.has(loc.booking_id)) {
        driverPosByBooking.set(loc.booking_id, { lat: loc.latitude, lng: loc.longitude })
      }
    }
  }

  type Point = DispatchMapPoint & { lat: number; lng: number }
  const points: Point[] = []

  for (const b of activeBookings ?? []) {
    const pos = driverPosByBooking.get(b.id)
    if (pos) points.push({ bookingId: b.id, bookingNumber: b.booking_number, kind: 'driver', ...pos })
  }
  for (const b of pendingBookings ?? []) {
    const loc = b.pickup_location as { lat?: number; lng?: number } | null
    if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
      points.push({ bookingId: b.id, bookingNumber: b.booking_number, kind: 'pending', lat: loc.lat, lng: loc.lng })
    }
  }

  const publicPoints: DispatchMapPoint[] = points.map(({ bookingId, bookingNumber, kind }) => ({ bookingId, bookingNumber, kind }))
  if (!points.length) return { url: null, points: publicPoints, quotaExceeded: false }

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!mapsKey) return { url: null, points: publicPoints, quotaExceeded: false }

  const allowed = await consumeLiveTrackingQuota(companyId)
  if (!allowed) return { url: null, points: publicPoints, quotaExceeded: true }

  // Verde = conductor en viaje activo. Ámbar = recogida pendiente sin asignar.
  // Static Maps solo admite una letra/número por marcador — con >9 puntos se
  // repiten (limitación aceptada, no hace falta más precisión visual aquí).
  const markers = points
    .map((p, i) => {
      const color = p.kind === 'driver' ? '0x22c55e' : '0xf59e0b'
      const label = String((i % 9) + 1)
      return `markers=${encodeURIComponent(`size:mid|color:${color}|label:${label}|${p.lat},${p.lng}`)}`
    })
    .join('&')

  const url =
    `https://maps.googleapis.com/maps/api/staticmap?size=1200x420&scale=2&maptype=roadmap&` +
    markers +
    `&key=${mapsKey}`

  return { url, points: publicPoints, quotaExceeded: false }
}
