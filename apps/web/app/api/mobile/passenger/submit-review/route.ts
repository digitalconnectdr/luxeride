// ── App móvil del pasajero — calificar viaje completado ────────────────────
// Reusa submitReviewAction (mismo núcleo que ya usa /review/[id] en la web,
// el link público que se manda por email al completar un viaje) — sin
// duplicar la validación de "solo completado, solo una vez". Esta ruta
// agrega una capa extra sobre esa: exige bearer token de rol 'customer' Y
// verifica que la reserva sea del usuario autenticado (submitReviewAction
// por sí sola no lo exige, porque el link público de la web funciona sin
// login — el bookingId es el secreto, igual que /track/[id]).
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'
import { submitReviewAction } from '@/app/actions/review'

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
  const rating = body?.rating
  const comment = typeof body?.comment === 'string' ? body.comment : ''
  if (typeof bookingId !== 'string' || typeof rating !== 'number') {
    return NextResponse.json({ success: false, error: 'Faltan datos de la calificación' }, { status: 400 })
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

  const result = await submitReviewAction(bookingId, rating, comment)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
