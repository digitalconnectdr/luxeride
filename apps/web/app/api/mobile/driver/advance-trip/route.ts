// ── App móvil del conductor — avanzar el estado de un viaje ────────────────────
// Único endpoint HTTP que necesita la app nativa: las lecturas (viaje activo)
// van directo a Supabase desde el cliente (RLS ya restringe a sus propios
// viajes — policy drivers_select_assigned_bookings). La escritura SÍ necesita
// pasar por aquí porque no existe una policy RLS de UPDATE para el rol driver
// (solo staff puede hacer UPDATE directo); el conductor avanza su viaje a
// través del service-role, con la misma lógica que ya usa /driver/trips en la
// web (advanceDriverTrip en app/actions/driver.ts) — sin duplicarla.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { advanceDriverTrip } from '@/app/actions/driver'

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

  const result = await advanceDriverTrip(user, bookingId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
