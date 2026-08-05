// ── App móvil del conductor — montos de cargo extra configurados ───────────────
// Antes de mostrar el panel de "Agregar cargo" la app necesita saber qué
// montos configuró el operador (0 = desactivado). Misma lógica que resuelve
// /driver/trips en la web (resolveDriverTripFees en app/actions/trip.ts).

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { resolveDriverTripFees } from '@/app/actions/trip'

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

  const result = await resolveDriverTripFees(user, bookingId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
