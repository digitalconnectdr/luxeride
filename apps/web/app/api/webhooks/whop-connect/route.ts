// ── Webhook de Whop Connect (Parte B, fase 2) — cobros a pasajeros ─────────────
// Distinto del webhook de la Parte A (/api/webhooks/whop, suscripción de la
// empresa a LuxeRide): este recibe eventos de PAGOS hechos por PASAJEROS a
// las cuentas conectadas de cada empresa. Requiere un webhook aparte creado
// en el dashboard de Whop sobre la company padre (WHOP_PARENT_COMPANY_ID)
// con "child resource events" habilitado, suscrito a payment.* y refund.* —
// y su propio secreto, WHOP_CONNECT_WEBHOOK_SECRET (NO el de la Parte A).
//
// Los nombres de evento aquí vienen del enum declarado en el SDK instalado
// (@whop/sdk — dot notation: payment.succeeded, refund.created, etc.). La
// Parte A nos enseñó que el dashboard real de Whop a veces usa snake_case en
// vez de punto — por eso se comprueban AMBAS variantes de forma defensiva.
// Antes de depender de esto en producción: dispara un pago de prueba real y
// revisa los logs de Vercel para confirmar el nombre exacto que llega.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWhopSignature } from '@/lib/billing/whop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function eventTypeMatches(type: string, canonical: string): boolean {
  return type === canonical || type === canonical.replace(/\./g, '_')
}

interface WhopPaymentData {
  id: string
  metadata: Record<string, unknown> | null
  checkout_configuration_id: string | null
  failure_message: string | null
}

interface WhopRefundData {
  id: string
  status: string
  payment: { id: string } | null
}

export async function POST(request: Request) {
  const secret = process.env.WHOP_CONNECT_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Whop Connect webhook not configured' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-whop-signature')

  if (!verifyWhopSignature(rawBody, signature, secret)) {
    console.error('[whop-connect/webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: { type?: string; data?: unknown } | null = null
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = body?.type ?? 'unknown'
  const admin = createAdminClient()

  try {
    if (eventTypeMatches(type, 'payment.succeeded')) {
      const data = body!.data as WhopPaymentData
      const paymentId = (data.metadata?.payment_id as string | undefined) ?? null

      const query = admin
        .from('payments')
        .update({
          status: 'succeeded',
          whop_payment_id: data.id,
          captured_at: new Date().toISOString(),
        })
        .neq('status', 'succeeded')

      if (paymentId) {
        await query.eq('id', paymentId)
      } else if (data.checkout_configuration_id) {
        await query.eq('whop_checkout_id', data.checkout_configuration_id)
      }
      return NextResponse.json({ received: true })
    }

    if (eventTypeMatches(type, 'payment.failed')) {
      const data = body!.data as WhopPaymentData
      const paymentId = (data.metadata?.payment_id as string | undefined) ?? null

      const query = admin
        .from('payments')
        .update({ status: 'failed', whop_payment_id: data.id, failure_message: data.failure_message ?? null })
        .neq('status', 'succeeded')

      if (paymentId) {
        await query.eq('id', paymentId)
      } else if (data.checkout_configuration_id) {
        await query.eq('whop_checkout_id', data.checkout_configuration_id)
      }
      return NextResponse.json({ received: true })
    }

    if (eventTypeMatches(type, 'refund.created') || eventTypeMatches(type, 'refund.updated')) {
      const data = body!.data as WhopRefundData
      const originalPaymentId = data.payment?.id
      if (!originalPaymentId) return NextResponse.json({ received: true, warning: 'no payment id' })

      const { data: payment } = await admin
        .from('payments')
        .select('id')
        .eq('whop_payment_id', originalPaymentId)
        .maybeSingle()
      if (!payment) return NextResponse.json({ received: true, skipped: 'unknown payment' })

      await admin
        .from('refunds')
        .update({
          whop_refund_id: data.id,
          status: data.status === 'succeeded' ? 'succeeded' : data.status === 'failed' ? 'failed' : 'pending',
        })
        .eq('payment_id', payment.id)
        .is('whop_refund_id', null)

      return NextResponse.json({ received: true })
    }

    return NextResponse.json({ received: true, ignored: type })
  } catch (err) {
    console.error(`[whop-connect/webhook] error handling ${type}`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }
}
