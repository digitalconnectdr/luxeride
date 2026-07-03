// ── Webhook de Whop — activación automática de la suscripción a la plataforma ──
// Reemplaza (complementa) la aprobación manual en /super-admin/subscriptions:
// cuando un operador paga vía Whop, este endpoint activa su empresa sin
// intervención del super-admin. Correlación por EMAIL (companies.email) —
// ver nota de diseño en lib/billing/whop.ts sobre los campos del payload.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { activateCompanySubscription } from '@/lib/billing/subscriptions'
import { isWhopConfigured, verifyWhopSignature, parseWhopEvent, isWhopSuccessEvent, mapWhopPlanId } from '@/lib/billing/whop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!isWhopConfigured()) {
    return NextResponse.json({ error: 'Whop not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-whop-signature')

  if (!verifyWhopSignature(rawBody, signature, process.env.WHOP_WEBHOOK_SECRET!)) {
    console.error('[whop/webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = parseWhopEvent(body)

  if (!isWhopSuccessEvent(event.type)) {
    // Evento que no nos interesa (ej. cancelación, expiración) — 200 para no
    // que Whop lo reintente. Se puede extender más adelante si se necesita
    // desactivar automáticamente al cancelar.
    return NextResponse.json({ received: true, ignored: event.type })
  }

  if (!event.email) {
    console.error('[whop/webhook] no email found in payload', JSON.stringify(body))
    return NextResponse.json({ received: true, warning: 'no email in payload' })
  }

  const admin = createAdminClient()

  try {
    const { data: company } = await admin
      .from('companies')
      .select('id, whop_membership_id')
      .ilike('email', event.email)
      .maybeSingle()

    if (!company) {
      console.error(`[whop/webhook] no company found for email ${event.email}`)
      return NextResponse.json({ received: true, warning: 'no matching company' })
    }

    // Idempotencia: Whop puede reintentar el mismo evento.
    if (event.membershipId && company.whop_membership_id === event.membershipId) {
      return NextResponse.json({ received: true, skipped: 'already processed' })
    }

    const plan = mapWhopPlanId(event.planId)
    const result = await activateCompanySubscription(admin, company.id, 1, plan)
    if (!result.success) {
      console.error('[whop/webhook] activation failed', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await admin
      .from('companies')
      .update({
        whop_membership_id: event.membershipId ?? company.whop_membership_id,
        whop_plan_id: event.planId ?? undefined,
      })
      .eq('id', company.id)

    return NextResponse.json({ received: true, activated: company.id })
  } catch (err) {
    console.error('[whop/webhook] handler error', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }
}
