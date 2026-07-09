// ── App móvil del conductor — completar viaje (pago en efectivo + firma) ──────
// Ver la nota de app/api/mobile/driver/advance-trip/route.ts sobre por qué
// esto no puede ser un update directo de Supabase desde el cliente.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { completeDriverTripWithExtras } from '@/app/actions/driver'

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

  let body: { bookingId?: string; cashAmount?: number; signaturePath?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!body.bookingId) {
    return NextResponse.json({ success: false, error: 'Falta bookingId' }, { status: 400 })
  }

  const result = await completeDriverTripWithExtras(user, body.bookingId, {
    cashAmount: body.cashAmount,
    signaturePath: body.signaturePath,
  })
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
