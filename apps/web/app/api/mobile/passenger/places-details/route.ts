// ── App móvil del pasajero — resolver un place_id a lat/lng ────────────────
// Sin bearer token, mismo motivo que /places-autocomplete.

import { NextResponse } from 'next/server'
import { getPlaceDetails } from '@/lib/maps/places-autocomplete'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!(await checkRateLimit('places_details', 30))) {
    return NextResponse.json({ success: false, error: RATE_LIMIT_ERROR }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const placeId = body?.placeId
  const sessionToken = body?.sessionToken
  if (typeof placeId !== 'string' || typeof sessionToken !== 'string' || !placeId || !sessionToken) {
    return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 })
  }

  const details = await getPlaceDetails(placeId, sessionToken)
  if (!details) {
    return NextResponse.json({ success: false, error: 'No se pudo resolver la dirección' }, { status: 404 })
  }

  return NextResponse.json({ success: true, ...details })
}
