// ── Cron diario: backfill de ciudad/país en reservas históricas ───────────
// Las reservas nuevas ya se geocodifican en background al crearse (ver
// geocodeBookingLocations en createPublicBookingAction/createBookingAction)
// — este cron solo procesa las que quedaron sin ese dato (todas las
// anteriores a que existiera esta feature). Tope de 100 por corrida para no
// generar un pico de costo/tiempo contra la Geocoding API; a este ritmo se
// pone al día en pocos días sin que el usuario tenga que hacer nada.
// Protegido con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { reverseGeocode } from '@/lib/maps/reverse-geocode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 100

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

interface LocationJson {
  lat?: number
  lng?: number
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, pickup_location, dropoff_location')
    .is('pickup_city', null)
    .not('pickup_location', 'is', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (!bookings?.length) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  // '' (no NULL) marca "ya se intentó, sin dato disponible" — así una
  // reserva con coordenadas raras/sin resultado de Google no bloquea la
  // cola para siempre (el filtro de arriba es pickup_city IS NULL). El
  // motor de agregación descarta '' igual que null (string vacío es falsy).
  let processed = 0
  for (const booking of bookings) {
    const pickup = booking.pickup_location as LocationJson | null
    const dropoff = booking.dropoff_location as LocationJson | null
    if (pickup?.lat == null || pickup?.lng == null || dropoff?.lat == null || dropoff?.lng == null) {
      await admin.from('bookings').update({ pickup_city: '', dropoff_city: '' }).eq('id', booking.id)
      processed++
      continue
    }

    const [pickupGeo, dropoffGeo] = await Promise.all([
      reverseGeocode(pickup.lat, pickup.lng),
      reverseGeocode(dropoff.lat, dropoff.lng),
    ])

    await admin
      .from('bookings')
      .update({
        pickup_city: pickupGeo?.city ?? '',
        pickup_country: pickupGeo?.country ?? null,
        dropoff_city: dropoffGeo?.city ?? '',
        dropoff_country: dropoffGeo?.country ?? null,
      })
      .eq('id', booking.id)
    processed++
  }

  return NextResponse.json({ ok: true, processed, batch: bookings.length })
}
