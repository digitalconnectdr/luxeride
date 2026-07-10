// ── App móvil del conductor — rechazar un viaje asignado ───────────────────────
// Misma lógica que ya usa /driver/trips en la web (driverRejectTrip en
// app/actions/driver.ts) — sin duplicarla.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { driverRejectTrip } from '@/app/actions/driver'

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
  let reason: string | undefined
  try {
    const body = await request.json()
    bookingId = body?.bookingId
    reason = body?.reason
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Falta bookingId' }, { status: 400 })
  }

  const result = await driverRejectTrip(user, bookingId, reason ?? '')
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
