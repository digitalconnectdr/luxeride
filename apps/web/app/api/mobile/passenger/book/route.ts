// ── App móvil del pasajero — crear reserva ─────────────────────────────────
// Bearer token requerido (rol 'customer') — delega a createPublicBookingAction
// (el mismo núcleo del guest checkout público) pasando customerId: user.id,
// para que la reserva quede asociada a la cuenta y aparezca en Historial
// (RLS customers_select_own_bookings, ya existente).

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createPublicBookingAction, type StopInput } from '@/app/actions/bookings'
import type { BookingType } from '@/lib/supabase/database.types'

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

  const quoteId = body?.quoteId
  const companySlug = body?.companySlug
  const passengerName = body?.passengerName
  const passengerPhone = body?.passengerPhone
  const scheduledAt = body?.scheduledAt
  const pickupAddress = body?.pickupAddress
  const pickupLat = body?.pickupLat
  const pickupLng = body?.pickupLng
  const dropoffAddress = body?.dropoffAddress
  const dropoffLat = body?.dropoffLat
  const dropoffLng = body?.dropoffLng
  if (
    typeof quoteId !== 'string' || typeof companySlug !== 'string' ||
    typeof passengerName !== 'string' || typeof passengerPhone !== 'string' ||
    typeof scheduledAt !== 'string' ||
    typeof pickupAddress !== 'string' || typeof pickupLat !== 'number' || typeof pickupLng !== 'number' ||
    typeof dropoffAddress !== 'string' || typeof dropoffLat !== 'number' || typeof dropoffLng !== 'number'
  ) {
    return NextResponse.json({ success: false, error: 'Faltan datos de la reserva' }, { status: 400 })
  }

  const result = await createPublicBookingAction({
    quoteId,
    slug: companySlug,
    bookingType: (typeof body?.bookingType === 'string' ? body.bookingType : 'one_way') as BookingType,
    passengerName,
    passengerPhone,
    passengerEmail: typeof body?.passengerEmail === 'string' ? body.passengerEmail : undefined,
    passengerCount: typeof body?.passengerCount === 'number' ? body.passengerCount : 1,
    specialInstructions: typeof body?.specialInstructions === 'string' ? body.specialInstructions : undefined,
    flightNumber: typeof body?.flightNumber === 'string' ? body.flightNumber : undefined,
    meetAndGreet: Boolean(body?.meetAndGreet),
    signName: typeof body?.signName === 'string' ? body.signName : undefined,
    scheduledAt,
    pickupAddress,
    pickupLat,
    pickupLng,
    dropoffAddress,
    dropoffLat,
    dropoffLng,
    stops: Array.isArray(body?.stops) ? (body.stops as StopInput[]) : undefined,
    customerId: user.id,
    source: 'mobile_app',
    paymentMethodIntent:
      body?.paymentMethodIntent === 'card' || body?.paymentMethodIntent === 'cash'
        ? body.paymentMethodIntent
        : undefined,
    luggageCarryOn: typeof body?.luggageCarryOn === 'number' ? body.luggageCarryOn : undefined,
    luggageChecked: typeof body?.luggageChecked === 'number' ? body.luggageChecked : undefined,
    luggageExtraLarge: typeof body?.luggageExtraLarge === 'number' ? body.luggageExtraLarge : undefined,
  })

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
