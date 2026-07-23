// ── App móvil del pasajero — crear cuenta ──────────────────────────────────
// Único endpoint de /api/mobile/passenger/* que NO requiere bearer token —
// es el que lo produce. Body: { companySlug, email, password, firstName,
// lastName, dateOfBirth, phone? }. Devuelve { success, session } — la app
// guarda la sesión (access_token/refresh_token) en su propio AsyncStorage.

import { NextResponse } from 'next/server'
import { signupPassengerCore } from '@/app/actions/passenger-auth'

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
  const email = body?.email
  const password = body?.password
  const firstName = body?.firstName
  const lastName = body?.lastName
  const dateOfBirth = body?.dateOfBirth
  if (
    typeof companySlug !== 'string' || typeof email !== 'string' ||
    typeof password !== 'string' || typeof firstName !== 'string' || typeof lastName !== 'string' ||
    typeof dateOfBirth !== 'string'
  ) {
    return NextResponse.json({ success: false, error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const result = await signupPassengerCore({
    companySlug,
    email,
    password,
    firstName,
    lastName,
    dateOfBirth,
    phone: typeof body?.phone === 'string' ? body.phone : undefined,
  })

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
