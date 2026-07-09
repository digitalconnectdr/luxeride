// ── Webhook de Whop — activación/suspensión automática de la suscripción ───────
// Reemplaza (complementa) la aprobación manual en /super-admin/subscriptions:
// cuando un operador paga vía Whop (membership_activated), este endpoint
// activa su empresa (y actualiza el plan si cambió — soporta upgrade/
// downgrade Starter↔Professional↔Enterprise sobre la misma membresía);
// cuando deja de pagar/cancela (membership_deactivated), la suspende.
// Correlación por EMAIL en la activación (companies.email); en la
// desactivación SOLO por whop_membership_id EXACTO (sin fallback por email)
// — así un evento de desactivación de una membresía ya reemplazada (por un
// upgrade/downgrade que creó una membresía nueva) no suspende por error una
// cuenta que ya está al día. Ver nota de diseño en lib/billing/whop.ts.

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
  isAffiliateAddonPlan,
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
    // Solo actúa si la membresía desactivada es la QUE TENEMOS REGISTRADA
    // ahora mismo — sin esto, un evento de desactivación de una membresía
    // vieja (reemplazada por un upgrade/downgrade) podría suspender una
    // cuenta que ya está al día en su membresía nueva.
    if (isWhopDeactivationEvent(event.type)) {
      if (!event.membershipId) {
        console.error('[whop/webhook] deactivation without membership id', JSON.stringify(body))
        return NextResponse.json({ received: true, warning: 'no membership id in payload' })
      }

      // Sección G: ¿es la membresía del ADD-ON de Affiliate Network? Se apaga
      // SOLO esa bandera — nunca se suspende la cuenta por cancelar un add-on.
      const { data: addonCompany } = await admin
        .from('companies')
        .select('id')
        .eq('affiliate_network_whop_membership_id', event.membershipId)
        .maybeSingle()

      if (addonCompany) {
        const { error } = await admin
          .from('companies')
          .update({ affiliate_network_enabled: false, affiliate_network_whop_membership_id: null })
          .eq('id', addonCompany.id)
        if (error) {
          console.error('[whop/webhook] affiliate add-on deactivation failed', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        return NextResponse.json({ received: true, affiliateAddonDisabled: addonCompany.id })
      }

      const { data: company } = await admin
        .from('companies')
        .select('id')
        .eq('whop_membership_id', event.membershipId)
        .maybeSingle()

      if (!company) {
        // Puede ser una membresía vieja ya reemplazada — no es un error, se ignora a propósito.
        return NextResponse.json({ received: true, skipped: 'membership not current for any company' })
      }

      const { error } = await admin.from('companies').update({ status: 'suspended' }).eq('id', company.id)
      if (error) {
        console.error('[whop/webhook] suspension failed', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ received: true, suspended: company.id })
    }

    // ── Cualquier otro evento no manejado ────────────────────────────────────
    if (!isWhopSuccessEvent(event.type)) {
      return NextResponse.json({ received: true, ignored: event.type })
    }

    // ── Activación (incluye upgrade/downgrade de plan) ──────────────────────
    if (!event.email) {
      console.error('[whop/webhook] no email found in payload', JSON.stringify(body))
      return NextResponse.json({ received: true, warning: 'no email in payload' })
    }

    const { data: company } = await admin
      .from('companies')
      .select('id, whop_membership_id, whop_plan_id, whop_last_event_id, affiliate_network_whop_membership_id')
      .ilike('email', event.email)
      .maybeSingle()

    if (!company) {
      console.error(`[whop/webhook] no company found for email ${event.email}`)
      return NextResponse.json({ received: true, warning: 'no matching company' })
    }

    // Sección G: activación del add-on de Affiliate Network — ciclo de cobro
    // propio, independiente del plan principal. No pasa por
    // activateCompanySubscription (eso es solo para los 4 planes base) ni por
    // el chequeo de idempotencia de whop_last_event_id (ese campo es del plan
    // principal, no del add-on).
    if (isAffiliateAddonPlan(event.planId)) {
      if (company.affiliate_network_whop_membership_id === event.membershipId) {
        return NextResponse.json({ received: true, skipped: 'affiliate add-on already active' })
      }
      const { error } = await admin
        .from('companies')
        .update({
          affiliate_network_enabled: true,
          affiliate_network_enabled_at: new Date().toISOString(),
          affiliate_network_whop_membership_id: event.membershipId,
        })
        .eq('id', company.id)
      if (error) {
        console.error('[whop/webhook] affiliate add-on activation failed', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ received: true, affiliateAddonEnabled: company.id })
    }

    // Idempotencia: solo se ignora si es la MISMA entrega del webhook
    // reintentada (eventId), nunca por coincidir el membership_id — un
    // upgrade/downgrade dispara un evento nuevo sobre la misma membresía y
    // SÍ debe procesarse (actualiza el plan).
    if (event.eventId && company.whop_last_event_id === event.eventId) {
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
        whop_plan_id: event.planId ?? company.whop_plan_id,
        whop_last_event_id: event.eventId ?? company.whop_last_event_id,
      })
      .eq('id', company.id)

    return NextResponse.json({ received: true, activated: company.id, plan: plan ?? null })
  } catch (err) {
    console.error('[whop/webhook] handler error', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }
}
