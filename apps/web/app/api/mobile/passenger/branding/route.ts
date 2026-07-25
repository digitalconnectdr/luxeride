// ── App móvil del pasajero — marca de la empresa (white-label) ────────────
// Sin bearer token (se llama ANTES de que exista sesión, al abrir la app —
// es lo primero que se pinta: logo/nombre/color de la empresa dueña de este
// build). `companies` no tiene policy RLS de lectura pública (solo sus
// propios miembros vía `company_members_select`) — igual que el resto del
// booking público, esto pasa por admin client server-side, nunca por el
// cliente Supabase directo de la app.
//
// Este endpoint es lo que hace posible el modelo white-label: la app (un
// solo build de "LuxeRide" en las stores, o un build de marca propia por
// operador Enterprise — ver docs/PHASE-2-MOBILE.md) pinta el logo/color de
// LA EMPRESA configurada en EXPO_PUBLIC_COMPANY_SLUG, nunca un branding fijo
// compilado en la app.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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
  if (typeof companySlug !== 'string' || !companySlug) {
    return NextResponse.json({ success: false, error: 'Falta companySlug' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, logo_url, primary_color, status, phone, email')
    .eq('slug', companySlug)
    .single()

  if (!company || company.status !== 'active') {
    return NextResponse.json({ success: false, error: 'Empresa no disponible' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    name: company.name,
    slug: company.slug,
    logoUrl: company.logo_url,
    primaryColor: company.primary_color,
    // Contacto de la EMPRESA OPERADORA — es a quien el pasajero debe escribir
    // por su servicio (un problema con la app se reporta aparte, por
    // /api/mobile/passenger/feedback, que llega a LuxeRide).
    supportPhone: company.phone,
    supportEmail: company.email,
  })
}
