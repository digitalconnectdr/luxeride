// ── App móvil del conductor — detalle completo de un viaje de afiliado ────────
// affiliate_trips solo guarda preview_* + booking_id; el detalle real
// (pickup/dropoff exactos, nombre y teléfono del pasajero) vive en `bookings`,
// que pertenece a la empresa PRINCIPAL — el conductor del afiliado no tiene
// RLS para leer esa fila directo (ni debería, protege al pasajero). Por eso
// esto pasa por service-role, verificando primero que el viaje afiliado sea
// realmente suyo.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (user.role !== 'driver') {
    return NextResponse.json({ success: false, error: 'Solo conductores' }, { status: 403 })
  }

  let affiliateTripId: string | undefined
  try {
    const body = await request.json()
    affiliateTripId = body?.affiliateTripId
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!affiliateTripId) {
    return NextResponse.json({ success: false, error: 'Falta affiliateTripId' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('affiliate_trips')
    .select('id, status, driver_id, booking_id, branding_mode, en_route_at, arrived_at, started_at, completed_at')
    .eq('id', affiliateTripId)
    .eq('driver_id', user.id)
    .maybeSingle()

  if (!trip) return NextResponse.json({ success: false, error: 'Viaje no encontrado o no asignado a ti' }, { status: 404 })

  const { data: booking } = await admin
    .from('bookings')
    .select('booking_number, passenger_name, passenger_phone, pickup_location, dropoff_location, flight_number, flight_status, flight_delay_minutes')
    .eq('id', trip.booking_id)
    .maybeSingle()

  return NextResponse.json({
    success: true,
    trip: { ...trip, ...(booking ?? {}) },
  })
}
