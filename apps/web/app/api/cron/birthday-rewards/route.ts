// ── Cron diario: recompensas de cumpleaños ────────────────────────────────────
// El disparador 'birthday' de reward_rules (migración 79) no lo dispara un
// viaje ni una reseña: lo dispara el calendario. Por empresa, se le pregunta
// a grantBirthdayRewards() a quién le toca hoy y otorga lo que corresponda.
// Protegido con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { grantBirthdayRewards } from '@/lib/rewards/grant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Solo empresas activas, y solo las que de hecho tienen una regla de
  // cumpleaños activa — evita recorrer perfiles de clientes de empresas que
  // nunca configuraron esta recompensa.
  const { data: companiesWithRule } = await admin
    .from('reward_rules')
    .select('company_id')
    .eq('trigger_type', 'birthday')
    .eq('is_active', true)

  const companyIds = Array.from(new Set((companiesWithRule ?? []).map((r) => r.company_id)))
  if (!companyIds.length) {
    return NextResponse.json({ ok: true, companies: 0, granted: 0 })
  }

  let totalGranted = 0
  for (const companyId of companyIds) {
    const result = await grantBirthdayRewards(companyId)
    totalGranted += result.granted
  }

  return NextResponse.json({ ok: true, companies: companyIds.length, granted: totalGranted })
}
