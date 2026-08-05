// ── App móvil del conductor — agregar un cargo extra durante el viaje ──────────
// Misma lógica que ya usa /driver/trips en la web (addDriverExtraCharge en
// app/actions/trip.ts) — sin duplicarla. Antes esta capacidad (cobrar
// pasajero/equipaje extra) solo existía en el portal web del conductor.

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { addDriverExtraCharge, type ExtraChargeType } from '@/app/actions/trip'

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
  let type: ExtraChargeType | undefined
  let qty: number | undefined
  let customAmount: number | undefined
  try {
    const body = await request.json()
    bookingId = body?.bookingId
    type = body?.type
    qty = body?.qty
    customAmount = typeof body?.customAmount === 'number' ? body.customAmount : undefined
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  const hasQty = type === 'toll_parking' ? true : typeof qty === 'number'
  if (!bookingId || !type || !hasQty) {
    return NextResponse.json({ success: false, error: 'Faltan datos del cargo' }, { status: 400 })
  }

  const result = await addDriverExtraCharge(user, bookingId, type, qty ?? 1, customAmount)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
