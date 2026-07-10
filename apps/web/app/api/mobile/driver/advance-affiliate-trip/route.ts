// ── App móvil del conductor — avanzar el estado de un viaje de afiliado ────────
// Reusa el core advanceAffiliateTrip (app/actions/affiliates.ts), que ya
// valida por sí solo (ownership + rol) contra el SessionUser recibido — acá
// solo se resuelve ese usuario desde el bearer token en vez de la cookie web.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { advanceAffiliateTrip } from '@/app/actions/affiliates'

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

  let affiliateTripId: string | undefined
  try {
    const body = await request.json()
    affiliateTripId = body?.affiliateTripId
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!affiliateTripId) {
    return NextResponse.json({ success: false, error: 'Falta affiliateTripId' }, { status: 400 })
  }

  const result = await advanceAffiliateTrip(user, affiliateTripId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
