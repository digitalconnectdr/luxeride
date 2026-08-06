// ── Cron: chequeo completo de sistema + alerta por email/SMS SOLO en
// transición de estado (ok/degraded/unknown → down, o down → ok) — nunca en
// cada corrida, para no saturar al super-admin con el mismo aviso repetido.
// Protegido con CRON_SECRET. Programado en vercel.json.
//
// IMPORTANTE — límite de frecuencia: en el plan Hobby, un cron programado a
// más de 1 vez/día no se degrada solo — Vercel RECHAZA TODO EL DEPLOYMENT
// (no solo este cron) con el error "Hobby accounts are limited to daily cron
// jobs" (confirmado en vivo: bloqueó 2 deployments seguidos con
// "*/15 * * * *" aquí). Por eso vercel.json lo tiene a diario. Para alertas
// en tiempo real de una caída real, apunta un monitor externo gratuito
// (ej. UptimeRobot, cada 5 min) a /api/health — ese endpoint SÍ corre fuera
// de Vercel y de verdad detecta si Vercel está caído.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runAllHealthChecks, SERVICE_LABELS, type HealthStatus } from '@/lib/monitoring/health'
import { sendSuperAdminEmail, sendSuperAdminSms } from '@/lib/notifications'
import type { Json } from '@/lib/supabase/database.types'

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

  const [{ data: previousRows }, results] = await Promise.all([
    admin.from('system_health_checks').select('service, status'),
    runAllHealthChecks(),
  ])
  const previousByService = new Map((previousRows ?? []).map((r) => [r.service, r.status as HealthStatus]))

  await admin.from('system_health_checks').upsert(
    results.map((r) => ({
      service: r.service,
      status: r.status,
      message: r.message ?? null,
      response_ms: r.responseMs ?? null,
      meta: (r.meta as Json | undefined) ?? null,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'service' },
  )

  const wentDown = results.filter((r) => r.status === 'down' && previousByService.get(r.service) !== 'down')
  const recovered = results.filter((r) => r.status === 'ok' && previousByService.get(r.service) === 'down')

  let alertsSent = 0
  if (wentDown.length > 0) {
    const lines = wentDown.map((r) => `• ${SERVICE_LABELS[r.service] ?? r.service}${r.message ? `: ${r.message}` : ''}`)
    const subject = `🔴 LuxeRide: ${wentDown.length} servicio(s) caído(s)`
    const body = `Se detectó una caída en:\n\n${lines.join('\n')}\n\nRevisa el panel: ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/super-admin/system`
    const [{ sent: emailSent }, { sent: smsSent }] = await Promise.all([
      sendSuperAdminEmail(subject, body),
      sendSuperAdminSms(`LuxeRide: ${wentDown.length} servicio(s) caído(s) — ${wentDown.map((r) => SERVICE_LABELS[r.service] ?? r.service).join(', ')}. Revisa tu email.`),
    ])
    alertsSent += emailSent + smsSent
  }
  if (recovered.length > 0) {
    const lines = recovered.map((r) => `• ${SERVICE_LABELS[r.service] ?? r.service}`)
    const subject = `🟢 LuxeRide: ${recovered.length} servicio(s) recuperado(s)`
    const body = `Volvieron a funcionar:\n\n${lines.join('\n')}`
    const { sent: emailSent } = await sendSuperAdminEmail(subject, body)
    alertsSent += emailSent
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    down: results.filter((r) => r.status === 'down').length,
    degraded: results.filter((r) => r.status === 'degraded').length,
    wentDown: wentDown.map((r) => r.service),
    recovered: recovered.map((r) => r.service),
    alertsSent,
  })
}
