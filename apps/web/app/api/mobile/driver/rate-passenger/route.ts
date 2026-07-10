// ── App móvil del conductor — calificar al pasajero (viaje completado) ─────────
// Misma lógica que ya usa /driver/trips en la web (submitDriverRating en
// app/actions/driver.ts) — sin duplicarla.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { submitDriverRating } from '@/app/actions/driver'

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
  let rating: number | undefined
  let comment: string | undefined
  try {
    const body = await request.json()
    bookingId = body?.bookingId
    rating = body?.rating
    comment = body?.comment
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!bookingId || typeof rating !== 'number') {
    return NextResponse.json({ success: false, error: 'Faltan datos de la calificación' }, { status: 400 })
  }

  const result = await submitDriverRating(user, bookingId, rating, comment ?? '')
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
