// ── App móvil del pasajero — reportar un problema con la APP ──────────────
// Distinto de "Contactar soporte": eso va a la empresa operadora (teléfono /
// email que devuelve el endpoint de branding) porque es sobre el SERVICIO.
// Esto va a LuxeRide, que es quien puede arreglar la app.
//
// Reusa feature_requests (mismo buzón que ya alimentan el operador, el
// conductor y el cliente desde el tracking web) con source='customer', así
// aparece en la bandeja del super-admin sin construir nada nuevo.
import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'customer') {
    return NextResponse.json({ success: false, error: 'Solo pasajeros' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const type = body?.type === 'feature' ? 'feature' : 'bug'
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 2000) : ''

  if (!title) return NextResponse.json({ success: false, error: 'Escribe un título' }, { status: 400 })
  if (!description) return NextResponse.json({ success: false, error: 'Describe el problema' }, { status: 400 })

  const admin = createAdminClient()

  // company_id del pasajero — la bandeja del super-admin agrupa por empresa,
  // y saber de qué operación viene el reporte ayuda a reproducirlo.
  const { data: profile } = await admin.from('user_profiles').select('company_id').eq('id', user.id).maybeSingle()
  if (!profile?.company_id) {
    return NextResponse.json({ success: false, error: 'Cuenta sin empresa asignada' }, { status: 400 })
  }

  const { error } = await admin.from('feature_requests').insert({
    company_id: profile.company_id,
    requested_by: user.id,
    type,
    title,
    description,
    source: 'customer',
  })

  if (error) {
    console.error('[passenger/feedback]', error)
    return NextResponse.json({ success: false, error: 'No se pudo enviar. Intenta de nuevo.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
