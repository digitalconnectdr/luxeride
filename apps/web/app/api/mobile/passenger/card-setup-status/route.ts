// ── App móvil del pasajero — estado real del guardado de tarjeta ──────────
// Llamado justo después de que la app cierra el WebBrowser del checkout de
// setup de Whop — le da al pasajero un motivo específico si falló (en vez
// de dejarlo solo con "no encontramos tu tarjeta, intenta de nuevo").
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { getCardSetupStatusAction } from '@/app/actions/payments'

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

  const result = await getCardSetupStatusAction(companySlug, phone)
  return NextResponse.json({ success: true, ...result })
}
