// ── App móvil del pasajero — guardar tarjeta sin cobrar (Whop setup mode) ──
// Usado cuando el pasajero elige "Tarjeta al finalizar" y todavía no tiene
// ninguna tarjeta en archivo — la app abre la url devuelta en un WebBrowser,
// el webhook setup_intent.succeeded confirma el guardado del lado servidor.
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createCardSetupCheckoutAction } from '@/app/actions/payments'

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

  const result = await createCardSetupCheckoutAction(companySlug, phone)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
