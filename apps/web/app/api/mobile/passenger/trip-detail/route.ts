// ── App móvil del pasajero — conductor y vehículo asignados a un viaje ─────
// La pantalla de seguimiento en vivo muestra quién te recoge y en qué (foto,
// nombre, calificación, marca/modelo/color/placa). Nada de eso se puede leer
// directo por Supabase desde la app: `drivers` y `vehicles` tienen RLS
// scopeada a company_id (staff), no al pasajero. Misma solución que
// receipt/route.ts: ruta delgada con admin client + bearer token +
// verificación de ownership de la reserva.
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
  if (user.role !== 'customer') {
    return NextResponse.json({ success: false, error: 'Solo pasajeros' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const bookingId = body?.bookingId
  if (typeof bookingId !== 'string') {
    return NextResponse.json({ success: false, error: 'Falta bookingId' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, customer_id, driver_id, vehicle_id, duration_minutes, distance_miles, scheduled_at, en_route_at')
    .eq('id', bookingId)
    .single()
  if (!booking || booking.customer_id !== user.id) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  }

  // Conductor: el nombre vive en user_profiles y la foto/calificación en
  // drivers — ambas filas comparten el mismo id (drivers.id ES el user id,
  // mismo patrón que usa /admin/bookings/[id]).
  const [{ data: profile }, { data: driver }, { data: vehicle }] = await Promise.all([
    booking.driver_id
      ? admin.from('user_profiles').select('first_name, last_name, phone').eq('id', booking.driver_id).maybeSingle()
      : Promise.resolve({ data: null }),
    booking.driver_id
      ? admin.from('drivers').select('photo_url, rating, total_trips').eq('id', booking.driver_id).maybeSingle()
      : Promise.resolve({ data: null }),
    booking.vehicle_id
      ? admin.from('vehicles').select('make, model, year, color, plate_number').eq('id', booking.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    success: true,
    detail: {
      driver: profile
        ? {
            name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || null,
            phone: profile.phone ?? null,
            photoUrl: driver?.photo_url ?? null,
            rating: driver?.rating ?? null,
            totalTrips: driver?.total_trips ?? null,
          }
        : null,
      vehicle: vehicle
        ? {
            label: `${vehicle.make} ${vehicle.model}`.trim(),
            year: vehicle.year ?? null,
            color: vehicle.color ?? null,
            plate: vehicle.plate_number ?? null,
          }
        : null,
      durationMinutes: booking.duration_minutes ?? null,
      distanceMiles: booking.distance_miles ?? null,
      scheduledAt: booking.scheduled_at,
      enRouteAt: booking.en_route_at ?? null,
    },
  })
}
