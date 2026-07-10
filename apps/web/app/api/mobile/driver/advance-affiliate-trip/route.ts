// ── App móvil del conductor — avanzar el estado de un viaje de afiliado ────────
// Reusa advanceAffiliateTripAction (app/actions/affiliates.ts) tal cual, pero
// esa función no valida por sí sola quién la llama (se apoya en RLS +
// contexto de la página que la invoca en la web) — acá se agrega la
// verificación explícita de que el viaje sea del conductor autenticado antes
// de reusarla, ya que la ruta corre con service-role (bypassa RLS).

import { NextResponse } from 'next/server'
import { getUserFromBearerToken } from '@/lib/auth/mobile'
import { createAdminClient } from '@/lib/supabase/server'
import { advanceAffiliateTripAction } from '@/app/actions/affiliates'

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

  let affiliateTripId: string | undefined
  try {
    const body = await request.json()
    affiliateTripId = body?.affiliateTripId
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }
  if (!affiliateTripId) {
    return NextResponse.json({ success: false, error: 'Falta affiliateTripId' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('affiliate_trips')
    .select('id, driver_id')
    .eq('id', affiliateTripId)
    .eq('driver_id', user.id)
    .maybeSingle()
  if (!trip) return NextResponse.json({ success: false, error: 'Viaje no encontrado o no asignado a ti' }, { status: 404 })

  const result = await advanceAffiliateTripAction(affiliateTripId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
