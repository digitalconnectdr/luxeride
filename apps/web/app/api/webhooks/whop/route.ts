// ── Webhook de Whop — activación/suspensión automática de la suscripción ───────
// Reemplaza (complementa) la aprobación manual en /super-admin/subscriptions:
// cuando un operador paga vía Whop (membership_activated), este endpoint
// activa su empresa; cuando deja de pagar/cancela (membership_deactivated),
// la suspende. Correlación por EMAIL en la activación (companies.email);
// en la desactivación se prioriza whop_membership_id (guardado al activar)
// con email como respaldo. Ver nota de diseño en lib/billing/whop.ts.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { activateCompanySubscription } from '@/lib/billing/subscriptions'
import {
  isWhopConfigured,
  verifyWhopSignature,
  parseWhopEvent,
  isWhopSuccessEvent,
  isWhopDeactivationEvent,
  mapWhopPlanId,
} from '@/lib/billing/whop'

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
  const admin = createAdminClient()

  try {
    // ── Desactivación: el operador dejó de pagar o canceló ──────────────────
    if (isWhopDeactivationEvent(event.type)) {
      let companyId: string | null = null

      if (event.membershipId) {
        const { data } = await admin
          .from('companies')
          .select('id')
          .eq('whop_membership_id', event.membershipId)
          .maybeSingle()
        companyId = data?.id ?? null
      }
      if (!companyId && event.email) {
        const { data } = await admin
          .from('companies')
          .select('id')
          .ilike('email', event.email)
          .maybeSingle()
        companyId = data?.id ?? null
      }

      if (!companyId) {
        console.error('[whop/webhook] deactivation: no matching company', JSON.stringify(body))
        return NextResponse.json({ received: true, warning: 'no matching company for deactivation' })
      }

      const { error } = await admin.from('companies').update({ status: 'suspended' }).eq('id', companyId)
      if (error) {
        console.error('[whop/webhook] suspension failed', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ received: true, suspended: companyId })
    }

    // ── Cualquier otro evento no manejado ────────────────────────────────────
    if (!isWhopSuccessEvent(event.type)) {
      return NextResponse.json({ received: true, ignored: event.type })
    }

    // ── Activación ───────────────────────────────────────────────────────────
    if (!event.email) {
      console.error('[whop/webhook] no email found in payload', JSON.stringify(body))
      return NextResponse.json({ received: true, warning: 'no email in payload' })
    }

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
