// ── App móvil del pasajero — recibo/desglose de un viaje ───────────────────
// Mismo desglose que ya muestra /admin/bookings/[id] (tarifa base, descuento,
// propina, cargos, total) — booking_fees/payments tienen RLS scopeada a
// company_id (auth_company_id(), rol de staff), así que el pasajero no puede
// leerlos directo por Supabase. Ruta delgada con admin client + bearer token
// + verificación de ownership, igual patrón que las demás rutas mobile.
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'

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
    .select(
      'id, customer_id, booking_number, currency, base_amount, gratuity_amount, gratuity_pct, promo_discount_amount, total_amount, completed_at',
    )
    .eq('id', bookingId)
    .single()
  if (!booking || booking.customer_id !== user.id) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 })
  }

  const [{ data: fees }, { data: payments }] = await Promise.all([
    admin
      .from('booking_fees')
      .select('id, type, description, amount, created_at')
      .eq('booking_id', bookingId)
      .order('created_at'),
    admin
      .from('payments')
      .select('id, amount, status, payment_method, captured_at, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    success: true,
    receipt: {
      bookingNumber: booking.booking_number,
      currency: booking.currency ?? 'USD',
      baseAmount: booking.base_amount,
      gratuityAmount: booking.gratuity_amount,
      gratuityPct: booking.gratuity_pct,
      promoDiscountAmount: booking.promo_discount_amount,
      totalAmount: booking.total_amount,
      completedAt: booking.completed_at,
      fees: fees ?? [],
      payments: payments ?? [],
    },
  })
}
