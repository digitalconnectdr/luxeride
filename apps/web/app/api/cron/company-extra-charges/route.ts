// ── Cron diario: cobra cargos adicionales vencidos (LuxeRide → operador) ───
// Ver app/actions/company-billing.ts para el contexto completo. Por cada
// cargo activo con next_charge_date vencida: busca la tarjeta guardada del
// operador con la cuenta PADRE de Whop y cobra. Avanza next_charge_date SOLO
// si client.payments.create() respondió sin error — evita reintentar (y
// cobrar dos veces) al día siguiente sobre un cobro que Whop ya aceptó; si
// la tarjeta falta o la llamada falla, next_charge_date NO avanza (reintento
// natural mañana).

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getWhopClient, getWhopParentCompanyId } from '@/lib/whop/connect-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: due } = await admin
    .from('company_extra_charges')
    .select('id, company_id, label, amount_cents, currency, frequency_months, next_charge_date')
    .eq('active', true)
    .lte('next_charge_date', today)

  const client = getWhopClient()
  let charged = 0
  let failed = 0

  for (const charge of due ?? []) {
    if (!client) {
      failed++
      continue
    }

    const { data: company } = await admin
      .from('companies')
      .select('whop_billing_member_id')
      .eq('id', charge.company_id)
      .single()

    if (!company?.whop_billing_member_id) {
      console.error(`[cron/company-extra-charges] sin tarjeta guardada — company ${charge.company_id}`)
      failed++
      continue
    }

    const { data: paymentRow, error: insertErr } = await admin
      .from('company_extra_charge_payments')
      .insert({
        extra_charge_id: charge.id,
        company_id: charge.company_id,
        amount_cents: charge.amount_cents,
        currency: charge.currency,
        status: 'pending',
      })
      .select('id')
      .single()
    if (insertErr || !paymentRow) {
      console.error('[cron/company-extra-charges] insert payment', insertErr)
      failed++
      continue
    }

    try {
      const page = await client.paymentMethods.list({
        member_id: company.whop_billing_member_id,
        company_id: getWhopParentCompanyId(),
      })
      const card = page.data.find((m) => m.typename === 'CardPaymentMethod')
      if (!card) throw new Error('No se encontró tarjeta guardada en Whop')

      const payment = await client.payments.create({
        company_id: getWhopParentCompanyId(),
        member_id: company.whop_billing_member_id,
        payment_method_id: card.id,
        plan: {
          currency: charge.currency as never,
          initial_price: charge.amount_cents / 100,
          plan_type: 'one_time',
          title: charge.label,
          product: {
            external_identifier: `luxeride-extra-charge-${charge.company_id}`,
            title: 'Cargos adicionales LuxeRide',
          },
        },
        metadata: {
          extra_charge_payment_id: paymentRow.id,
          extra_charge_id: charge.id,
          company_id: charge.company_id,
        },
      })

      // Optimista: la confirmación definitiva llega luego por webhook
      // (payment.succeeded/failed), pero avanzar aquí evita reintentar (y
      // cobrar dos veces) mientras esa confirmación no llega.
      await admin
        .from('company_extra_charge_payments')
        .update({ status: 'succeeded', whop_payment_id: payment.id })
        .eq('id', paymentRow.id)

      await admin
        .from('company_extra_charges')
        .update({ next_charge_date: addMonths(charge.next_charge_date, charge.frequency_months) })
        .eq('id', charge.id)

      charged++
    } catch (err) {
      console.error(`[cron/company-extra-charges] charge ${charge.id}`, err)
      await admin
        .from('company_extra_charge_payments')
        .update({ status: 'failed', failure_message: err instanceof Error ? err.message : 'Error desconocido' })
        .eq('id', paymentRow.id)
      failed++
    }
  }

  return NextResponse.json({ ok: true, charged, failed, total: (due ?? []).length })
}
