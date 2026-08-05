// ── App móvil del conductor — marcar no-show ───────────────────────────────────
// Misma lógica que ya usa /driver/trips en la web (markDriverNoShow en
// app/actions/driver.ts) — sin duplicarla. Antes esta capacidad no existía en
// la app nativa: el conductor tenía que salir a la web para marcar no-show.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { markDriverNoShow } from '@/app/actions/driver'

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

  const result = await markDriverNoShow(user, bookingId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
