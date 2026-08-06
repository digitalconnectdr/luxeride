// ── Health check público, liviano — pensado para un monitor EXTERNO (ej.
// UptimeRobot) que necesita ver la app desde afuera para detectar de verdad
// que Vercel está caído (un chequeo que corre DENTRO del propio Vercel no
// puede detectar que Vercel está caído: si lo está, tampoco correría).
// Solo verifica que Supabase responda — no corre los 11 chequeos completos
// (ver /api/cron/system-health) para que un monitor que llama esto cada
// pocos minutos no le pegue de más a las integraciones externas.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const t0 = Date.now()
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('companies').select('id', { count: 'exact', head: true })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, ms: Date.now() - t0 }, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error desconocido', ms: Date.now() - t0 },
      { status: 503 },
    )
  }
}
