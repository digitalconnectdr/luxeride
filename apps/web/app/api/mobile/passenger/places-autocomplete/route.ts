// ── App móvil del pasajero — autocomplete de direcciones ───────────────────
// Sin bearer token (igual que /quote, no requiere cuenta) — proxya
// searchPlaceAutocomplete con la key de servidor, nunca expuesta a la app.
// Rate limit para no exponer la cuota de Places de la empresa a abuso.

import { NextResponse } from 'next/server'
import { searchPlaceAutocomplete } from '@/lib/maps/places-autocomplete'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!(await checkRateLimit('places_autocomplete', 30))) {
    return NextResponse.json({ success: false, error: RATE_LIMIT_ERROR }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const input = body?.input
  const sessionToken = body?.sessionToken
  if (typeof input !== 'string' || typeof sessionToken !== 'string' || !sessionToken) {
    return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 })
  }

  const predictions = await searchPlaceAutocomplete(input, sessionToken)
  return NextResponse.json({ success: true, predictions })
}
