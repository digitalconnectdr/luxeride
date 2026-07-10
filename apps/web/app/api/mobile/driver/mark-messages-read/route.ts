// ── App móvil del conductor — marcar mensajes del pasajero como leídos ─────────
// Lectura/envío de mensajes van directo desde el cliente vía Supabase (RLS:
// driver_reads_trip_messages / driver_writes_trip_messages). Marcar como
// leído es un UPDATE y no hay policy de UPDATE para el rol driver — pasa por
// aquí, misma lógica que markDriverMessagesRead en app/actions/trip.ts.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { markDriverMessagesRead } from '@/app/actions/trip'

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

  const result = await markDriverMessagesRead(user, bookingId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
