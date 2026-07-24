// ── Push de re-engagement para pasajeros inactivos ────────────────────────────
// Sprint 5 de PHASE-2-MOBILE.md: "¿Viajas pronto? Reserva tu traslado" para
// pasajeros con cuenta en la app que llevan un tiempo sin reservar. Corre
// 1x/semana vía vercel.json. Cooldown de 30 días manejado dentro de
// sendReengagementPush (tabla notifications) — puede correr más seguido sin
// riesgo de reenviar el mismo aviso.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendReengagementPush } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MIN_ACCOUNT_AGE_DAYS = 7
const INACTIVITY_WINDOW_DAYS = 21

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (request.headers.get('authorization') === `Bearer ${secret}`) return true
  const url = new URL(request.url)
  return url.searchParams.get('token') === secret
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()
  const accountCutoff = new Date(now - MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60_000).toISOString()
  const inactivityCutoff = new Date(now - INACTIVITY_WINDOW_DAYS * 24 * 60 * 60_000).toISOString()

  const { data: companies } = await admin
    .from('companies')
    .select('id, name')
    .eq('status', 'active')

  let sent = 0
  let checked = 0

  for (const company of companies ?? []) {
    const { data: customers } = await admin
      .from('user_profiles')
      .select('id')
      .eq('company_id', company.id)
      .eq('role', 'customer')
      .eq('is_active', true)
      .lte('created_at', accountCutoff)
      .limit(500)

    if (!customers || customers.length === 0) continue

    for (const customer of customers) {
      checked += 1

      // ¿Tuvo algún viaje (activo o pasado) dentro de la ventana de
      // inactividad? Si sí, sigue "caliente" — se salta sin gastar el
      // cooldown. cancelled/no_show cuentan igual: siguen mostrando
      // que la persona interactuó con la app recientemente.
      const { count: recentBookings } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .gte('created_at', inactivityCutoff)

      if (recentBookings && recentBookings > 0) continue

      const result = await sendReengagementPush({
        companyId: company.id,
        userId: customer.id,
        body: '¿Viajas pronto? Reserva tu traslado en un par de toques.',
      })
      if (result.sent) sent += 1
    }
  }

  return NextResponse.json({ ok: true, checked, sent })
}
