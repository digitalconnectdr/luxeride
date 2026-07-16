// ── Cron diario: referidos que cumplieron 12 meses ────────────────────────────
// La expiración en sí ya la respeta cada query de conteo/nivel (siempre
// filtra expires_at > now()) — este cron no necesita "apagar" nada en
// company_referrals. Su único trabajo es avisar al super-admin, porque la
// automatización con Whop (crear/quitar el override de comisión) todavía no
// está conectada: alguien tiene que desactivar esa comisión a mano en Whop.
// Protegido con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSuperAdminEmail } from '@/lib/notifications'

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
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: expiring } = await admin
    .from('company_referrals')
    .select('referrer_company_id, referred_company_id, tier_key, commission_pct, expires_at')
    .gt('expires_at', yesterday)
    .lte('expires_at', now)

  if (!expiring?.length) {
    return NextResponse.json({ ok: true, total: 0 })
  }

  const companyIds = Array.from(
    new Set(expiring.flatMap((r) => [r.referrer_company_id, r.referred_company_id])),
  )
  const { data: companies } = await admin.from('companies').select('id, name').in('id', companyIds)
  const nameById = new Map((companies ?? []).map((c) => [c.id, c.name]))

  const lines = expiring.map(
    (r) =>
      `- ${nameById.get(r.referrer_company_id) ?? r.referrer_company_id} → ${nameById.get(r.referred_company_id) ?? r.referred_company_id} (nivel ${r.tier_key}, ${r.commission_pct}%)`,
  )

  await sendSuperAdminEmail(
    `Referidos que cumplieron 12 meses (${expiring.length})`,
    [
      'Los siguientes referidos llegaron a su límite de 12 meses de comisión.',
      'La automatización con Whop todavía no está conectada — desactiva manualmente',
      'la comisión correspondiente en el dashboard de afiliados de Whop para cada uno:',
      '',
      ...lines,
    ].join('\n'),
  )

  return NextResponse.json({ ok: true, total: expiring.length })
}
