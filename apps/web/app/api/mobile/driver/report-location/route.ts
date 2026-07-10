// ── App móvil del conductor — reportar posición GPS en viaje activo ────────────
// Misma lógica que ya usa LiveLocationReporter en la web (reportDriverLocation
// en app/actions/live-tracking.ts) — sin duplicarla. El cliente (Expo Location)
// llama esto cada ~8-10s mientras el viaje está en un estado activo.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { reportDriverLocation } from '@/app/actions/live-tracking'

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
  let latitude: number | undefined
  let longitude: number | undefined
  try {
    const body = await request.json()
    bookingId = body?.bookingId
    latitude = body?.latitude
    longitude = body?.longitude
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!bookingId || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ success: false, error: 'Faltan datos de ubicación' }, { status: 400 })
  }

  const result = await reportDriverLocation(user, bookingId, latitude, longitude)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
