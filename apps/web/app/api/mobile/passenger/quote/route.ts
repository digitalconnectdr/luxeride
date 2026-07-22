// ── App móvil del pasajero — cotizar por tipo de vehículo ──────────────────
// Sin bearer token (cotizar no requiere cuenta, igual que el wizard público
// de la web) — delega directo a getPublicVehicleQuotesAction, el mismo
// núcleo que ya usa /book/[slug] (motor de precios, no se duplica nada).

import { NextResponse } from 'next/server'
import { getPublicVehicleQuotesAction, type StopInput } from '@/app/actions/bookings'
import type { BookingType } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const companySlug = body?.companySlug
  const pickupLat = body?.pickupLat
  const pickupLng = body?.pickupLng
  const dropoffLat = body?.dropoffLat
  const dropoffLng = body?.dropoffLng
  const scheduledAt = body?.scheduledAt
  if (
    typeof companySlug !== 'string' ||
    typeof pickupLat !== 'number' || typeof pickupLng !== 'number' ||
    typeof dropoffLat !== 'number' || typeof dropoffLng !== 'number' ||
    typeof scheduledAt !== 'string'
  ) {
    return NextResponse.json({ success: false, error: 'Faltan datos de la cotización' }, { status: 400 })
  }

  const result = await getPublicVehicleQuotesAction(companySlug, {
    pickupLat,
    pickupLng,
    pickupAddress: typeof body?.pickupAddress === 'string' ? body.pickupAddress : '',
    pickupPostalCode: typeof body?.pickupPostalCode === 'string' ? body.pickupPostalCode : null,
    dropoffLat,
    dropoffLng,
    dropoffAddress: typeof body?.dropoffAddress === 'string' ? body.dropoffAddress : '',
    dropoffPostalCode: typeof body?.dropoffPostalCode === 'string' ? body.dropoffPostalCode : null,
    scheduledAt,
    bookingType: (typeof body?.bookingType === 'string' ? body.bookingType : undefined) as BookingType | undefined,
    stops: Array.isArray(body?.stops) ? (body.stops as StopInput[]) : undefined,
  })

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
