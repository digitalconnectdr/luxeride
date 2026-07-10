// ── App móvil del conductor — reportar un incidente en viaje activo ────────────
// Misma lógica que ya usa /driver/trips en la web (reportDriverIncident en
// app/actions/driver.ts) — sin duplicarla.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { reportDriverIncident } from '@/app/actions/driver'

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
  let category: string | undefined
  let reason: string | undefined
  try {
    const body = await request.json()
    bookingId = body?.bookingId
    category = body?.category
    reason = body?.reason
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!bookingId || !category) {
    return NextResponse.json({ success: false, error: 'Faltan datos del incidente' }, { status: 400 })
  }

  const result = await reportDriverIncident(user, bookingId, category, reason ?? '')
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
