// ── Cron diario: suscripciones/pruebas por vencer ─────────────────────────────
// Avisa por email al super-admin de las empresas cuya suscripción
// (subscription_ends_at) o prueba (trial_ends_at) vence dentro de 7 días.
// Protegido con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendSuperAdminEmail } from '@/lib/notifications'
import { getAppUrl } from '@/lib/app-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WINDOW_DAYS = 7

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const limit = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)

  // Suscripciones activas por vencer
  const { data: subs } = await admin
    .from('companies')
    .select('name, slug, subscription_ends_at')
    .eq('status', 'active')
    .not('subscription_ends_at', 'is', null)
    .gte('subscription_ends_at', today)
    .lte('subscription_ends_at', limit)
    .order('subscription_ends_at')

  // Pruebas (trials) por vencer
  const { data: trials } = await admin
    .from('companies')
    .select('name, slug, trial_ends_at')
    .eq('status', 'trial')
    .not('trial_ends_at', 'is', null)
    .gte('trial_ends_at', today)
    .lte('trial_ends_at', limit)
    .order('trial_ends_at')

  const subRows = (subs ?? []).map((c) => `• ${c.name} (/${c.slug}) | vence en ${daysUntil(c.subscription_ends_at!)} día(s) [${new Date(c.subscription_ends_at!).toLocaleDateString('es-DO')}]`)
  const trialRows = (trials ?? []).map((c) => `• ${c.name} (/${c.slug}) | prueba termina en ${daysUntil(c.trial_ends_at!)} día(s) [${new Date(c.trial_ends_at!).toLocaleDateString('es-DO')}]`)

  const total = subRows.length + trialRows.length
  if (total === 0) {
    return NextResponse.json({ ok: true, total: 0, sent: 0 })
  }

  const appUrl = getAppUrl()
  const body = [
    `Hay ${total} empresa(s) con suscripción o prueba por vencer en los próximos ${WINDOW_DAYS} días.`,
    subRows.length ? `\nSuscripciones por vencer (${subRows.length}):\n${subRows.join('\n')}` : '',
    trialRows.length ? `\nPruebas por terminar (${trialRows.length}):\n${trialRows.join('\n')}` : '',
    `\nGestiónalas en: ${appUrl}/super-admin/subscriptions`,
  ].filter(Boolean).join('\n')

  const { sent } = await sendSuperAdminEmail(
    `Suscripciones por vencer: ${total} empresa(s)`,
    body,
  )

  return NextResponse.json({ ok: true, total, sent })
}
