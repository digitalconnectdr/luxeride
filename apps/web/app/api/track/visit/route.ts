// ── Beacon de visita al landing (mapa de geografía en /super-admin) ────────
// Llamado por components/tracking/visitor-geo-beacon.tsx en cada carga de
// una página pública de marketing (no admin/booking/micrositio). Solo se
// persiste la ciudad/región/país/coordenadas derivadas de la IP - la IP en
// sí nunca se guarda. Fire-and-forget: el cliente ignora la respuesta.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { resolveIpGeo } from '@/lib/tracking/ip-geo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Límite generoso mas no vacío - evita que un bot agresivo agote la cuota
  // gratuita de ipwho.is a costa de una sola IP.
  if (!(await checkRateLimit('landing_visit', 20, 60_000))) {
    return NextResponse.json({ success: false }, { status: 429 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // sin body es aceptable - se guarda igual sin `path`
  }
  const path = typeof body?.path === 'string' ? body.path.slice(0, 200) : null

  const ip = getClientIp()
  const geo = await resolveIpGeo(ip)

  const admin = createAdminClient()
  await admin.from('landing_page_visits').insert({
    path,
    city: geo?.city ?? null,
    region: geo?.region ?? null,
    country: geo?.country ?? null,
    country_code: geo?.countryCode ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
  })

  return NextResponse.json({ success: true })
}
