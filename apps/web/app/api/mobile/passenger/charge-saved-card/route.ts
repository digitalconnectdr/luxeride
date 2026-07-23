// ── App móvil del pasajero — cobrar con tarjeta Whop guardada (+ propina) ──
// Envuelve chargeWithSavedWhopCardAction (ya usado por el checkout público
// de la web) — mismo cálculo de monto, mismo flujo de webhook. Cubre el
// caso "el pasajero terminó su viaje, la empresa cobra en efectivo/después,
// pero él ya tiene una tarjeta guardada de un pago anterior con Whop": puede
// pagar el viaje (con o sin propina) directo desde la app, sin checkout
// nuevo. Si el viaje ya tiene un pago exitoso registrado, la acción interna
// ya rechaza el cobro (evita doble cobro) — no se duplica esa validación
// aquí, solo se agrega bearer token + ownership.
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'
import { chargeWithSavedWhopCardAction } from '@/app/actions/payments'

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
  const gratuityPct = typeof body?.gratuityPct === 'number' ? body.gratuityPct : undefined
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

  const result = await chargeWithSavedWhopCardAction(bookingId, gratuityPct)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
