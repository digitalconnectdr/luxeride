// ── App móvil del pasajero — ¿ya hay tarjeta guardada para este teléfono? ──
// A diferencia de /saved-card (que exige un bookingId ya existente), esta se
// usa ANTES de reservar — en BookingConfirmScreen, para decidir si mostrar
// "Tarjeta terminada en ####" o el flujo de "guarda tu tarjeta primero".
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { getSavedWhopCardByPhoneAction } from '@/app/actions/payments'

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

  const companySlug = body?.companySlug
  const phone = body?.phone
  if (typeof companySlug !== 'string' || typeof phone !== 'string') {
    return NextResponse.json({ success: false, error: 'Faltan datos' }, { status: 400 })
  }

  const result = await getSavedWhopCardByPhoneAction(companySlug, phone)
  return NextResponse.json({ success: true, ...result })
}
