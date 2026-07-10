// ── App móvil del conductor — imagen de mapa del viaje (pickup/destino/pasajero) ─
// Reusa buildTripStaticMapUrl (lib/tracking/static-map-url.ts), la misma
// función que ya arma el mapa estático de respaldo en /track/[id] — sin
// duplicar la lógica de marcadores/ruta. La clave de Google Maps
// (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) es pública, ya se expone al navegador
// en la web — no hay nada nuevo que proteger acá, solo se arma la URL en el
// servidor para no tener que reimplementar la lógica en el cliente móvil.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'
import { buildTripStaticMapUrl } from '@/lib/tracking/static-map-url'
import { getLiveTripPositionsAction } from '@/app/actions/live-tracking'

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

  let bookingId: string | undefined
  try {
    const body = await request.json()
    bookingId = body?.bookingId
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Falta bookingId' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, company_id, pickup_location, dropoff_location, route_polyline')
    .eq('id', bookingId)
    .eq('driver_id', user.id)
    .maybeSingle()

  if (!booking) return NextResponse.json({ success: false, error: 'Viaje no encontrado o no asignado a ti' }, { status: 404 })

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const pLoc = booking.pickup_location as { lat?: number; lng?: number } | null
  const dLoc = booking.dropoff_location as { lat?: number; lng?: number } | null
  if (!mapsKey || typeof pLoc?.lat !== 'number' || typeof pLoc?.lng !== 'number' || typeof dLoc?.lat !== 'number' || typeof dLoc?.lng !== 'number') {
    return NextResponse.json({ success: true, mapUrl: null, hasPassengerPos: false })
  }

  const { data: company } = await admin.from('companies').select('primary_color').eq('id', booking.company_id).maybeSingle()
  const positions = await getLiveTripPositionsAction(bookingId)

  const mapUrl = buildTripStaticMapUrl({
    pickup: { lat: pLoc.lat, lng: pLoc.lng },
    dropoff: { lat: dLoc.lat, lng: dLoc.lng },
    brandColor: company?.primary_color ?? '#e9c176',
    mapsKey,
    driverPos: positions?.driverPos ?? null,
    passengerPos: positions?.passengerPos ?? null,
    routePolyline: booking.route_polyline,
    size: '640x360',
  })

  return NextResponse.json({ success: true, mapUrl, hasPassengerPos: !!positions?.passengerPos })
}
