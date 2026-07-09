// ── App móvil del conductor — disponibilidad (en servicio / fuera) ────────────
// El upsert necesita service-role (algunos conductores no tienen fila en
// `drivers` todavía) — mismo motivo que el resto de rutas /api/mobile/driver/*.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { setDriverAvailability } from '@/app/actions/driver'

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

  let isAvailable: unknown
  try {
    const body = await request.json()
    isAvailable = body?.isAvailable
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (typeof isAvailable !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Falta isAvailable' }, { status: 400 })
  }

  const result = await setDriverAvailability(user, isAvailable)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
