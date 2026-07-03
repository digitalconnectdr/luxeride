'use server'
// ── Mapa en vivo de la flota (Dispatch Board) ──────────────────────────────────
// Mapa interactivo (JS API, con pan/zoom real): conductores de viajes activos
// (última posición reportada en trip_locations, ya construido para el tracking
// del pasajero) + pines de recogidas pendientes. Al ser un mapa JS que se carga
// una sola vez y solo reposiciona marcadores en cada refresco (no genera una
// imagen nueva por consulta), NO consume la cuota de Static Maps del tracking
// del pasajero — esa cuota existe específicamente por el costo de imagen-por-
// refresco, que aquí ya no aplica.

import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { BookingStatus } from '@/lib/supabase/database.types'

const ACTIVE_STATUSES: BookingStatus[] = ['en_route', 'arrived', 'in_progress']

export interface DispatchMapPoint {
  bookingId: string
  bookingNumber: string
  kind: 'driver' | 'pending'
  lat: number
  lng: number
}

export interface DispatchMapRefresh {
  points: DispatchMapPoint[]
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

  const points: DispatchMapPoint[] = []

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

  return { points }
}
