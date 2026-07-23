// ── App móvil del pasajero — consultar tarjeta Whop guardada ───────────────
// Envuelve getSavedWhopCardAction (ya usado por el checkout público de la
// web) — misma lógica exacta, solo agrega bearer token + verificación de
// ownership (defensa extra que el link público de la web no necesita,
// porque ahí no hay sesión de por medio).
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'
import { getSavedWhopCardAction } from '@/app/actions/payments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (user.role !== 'customer') {
    return NextResponse.json({ success: false, error: 'Solo pasajeros' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const bookingId = body?.bookingId
  if (typeof bookingId !== 'string') {
    return NextResponse.json({ success: false, error: 'Falta bookingId' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('customer_id')
    .eq('id', bookingId)
    .single()
  if (!booking || booking.customer_id !== user.id) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  }

  const result = await getSavedWhopCardAction(bookingId)
  return NextResponse.json({ success: true, ...result })
}
