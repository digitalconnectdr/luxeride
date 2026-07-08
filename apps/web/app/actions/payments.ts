'use server'
// ── F1.9 — Stripe + Stripe Connect: Server Actions ────────────────────────────
// SECURITY: Montos SIEMPRE del booking (server-side) — nunca del cliente.
// Placeholder-safe: si Stripe no está configurado, las acciones degradan limpio.

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getStripe } from '@/lib/stripe/server'
import { getWhopClient } from '@/lib/whop/connect-server'
import { createWhopCheckout } from '@/lib/whop/checkout'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'
import { getAppUrl } from '@/lib/app-url'

const APP_URL = getAppUrl()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

// ─── Helper: platform fee desde settings de la empresa ────────────────────────

function platformFeePct(settings: unknown): number {
  const s = settings as { payments?: { platform_fee_pct?: number } } | null
  const pct = s?.payments?.platform_fee_pct
  if (typeof pct !== 'number' || pct < 0 || pct > 50) return 0
  return pct
}

/** % de depósito si la empresa lo exige (0 = pago completo). */
function depositPct(settings: unknown): number {
  const s = settings as {
    booking?: { require_deposit?: boolean; deposit_percentage?: number }
  } | null
  if (!s?.booking?.require_deposit) return 0
  const pct = s.booking.deposit_percentage ?? 0
  if (typeof pct !== 'number' || pct <= 0 || pct >= 100) return 0
  return pct
}

/** Valida el % de propina contra la configuración de la empresa. */
function sanitizeGratuityPct(settings: unknown, requested: number | undefined): number {
  if (!requested || requested <= 0) return 0
  const s = settings as {
    gratuity?: { enabled?: boolean; options?: number[] }
  } | null
  if (s?.gratuity?.enabled === false) return 0
  // Acepta solo % razonables (las opciones de la empresa, o cualquier 1–50%)
  const pct = Math.floor(requested)
  if (pct < 1 || pct > 50) return 0
  return pct
}

// ─── Connect: iniciar onboarding (Express) ────────────────────────────────────

export async function createConnectOnboardingAction(): Promise<void> {
  const user = await requireRole('company_owner')
  if (!user.company_id) redirect('/admin/settings?stripe_error=no_company')

  const stripe = getStripe()
  if (!stripe) redirect('/admin/settings?stripe_error=not_configured')

  // redirect() lanza internamente — las llamadas a Stripe van en try/catch
  // y el redirect final se hace FUERA del try para no capturarlo.
  let onboardingUrl: string | null = null
  let errorCode = 'connect_failed'

  try {
    const admin = createAdminClient()
    const { data: company } = await admin
      .from('companies')
      .select('id, name, email, country, stripe_connect_account_id')
      .eq('id', user.company_id)
      .single()

    if (company) {
      let accountId = company.stripe_connect_account_id

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: company.country ?? 'US',
          email: company.email ?? user.email,
          business_profile: { name: company.name },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: { company_id: company.id },
        })
        accountId = account.id
        await admin
          .from('companies')
          .update({ stripe_connect_account_id: accountId })
          .eq('id', company.id)
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${APP_URL}/admin/settings?connect=refresh`,
        return_url: `${APP_URL}/admin/settings?connect=return`,
        type: 'account_onboarding',
      })
      onboardingUrl = link.url
    }
  } catch (err) {
    console.error('[createConnectOnboardingAction]', err)
    // Mensaje típico cuando la cuenta de Stripe no tiene Connect habilitado
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('signed up for Connect')) errorCode = 'connect_not_enabled'
    if (msg.includes('Invalid API Key') || msg.includes('api_key')) errorCode = 'invalid_key'
  }

  if (onboardingUrl) redirect(onboardingUrl)
  redirect(`/admin/settings?stripe_error=${errorCode}`)
}

// ─── Connect: refrescar estado de onboarding ──────────────────────────────────

export async function refreshConnectStatusAction(): Promise<ActionResult> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const stripe = getStripe()
  if (!stripe) return { success: false, error: 'Stripe no está configurado' }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('stripe_connect_account_id')
    .eq('id', user.company_id)
    .single()

  if (!company?.stripe_connect_account_id) {
    return { success: false, error: 'No hay cuenta de Stripe Connect' }
  }

  try {
    const account = await stripe.accounts.retrieve(company.stripe_connect_account_id)
    const onboarded = Boolean(account.charges_enabled && account.details_submitted)

    await admin
      .from('companies')
      .update({ stripe_connect_onboarded: onboarded })
      .eq('id', user.company_id)
  } catch (err) {
    console.error('[refreshConnectStatusAction]', err)
    return { success: false, error: 'No se pudo consultar el estado en Stripe' }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

// ─── Checkout: link de pago para una reservación (staff) ──────────────────────

export async function createPaymentLinkAction(
  bookingId: string,
): Promise<ActionResult<{ url: string }>> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'accounting')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, status, total_amount, currency, passenger_email, passenger_name, company_id')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .single()

  if (!booking) return { success: false, error: 'Reservación no encontrada' }

  return createCheckoutForBooking(booking.company_id, booking)
}

// ─── Checkout: pago online del portal público (guest) ─────────────────────────

export async function createPublicCheckoutAction(
  slug: string,
  bookingId: string,
  gratuityPct?: number,
): Promise<ActionResult<{ url: string }>> {
  // F1.17 — rate limit por IP
  if (!(await checkRateLimit('public_checkout', 5))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, status')
    .eq('slug', slug)
    .single()

  if (!company || company.status !== 'active') {
    return { success: false, error: 'Empresa no disponible' }
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, status, total_amount, currency, passenger_email, passenger_name, company_id')
    .eq('id', bookingId)
    .eq('company_id', company.id)
    .single()

  if (!booking) return { success: false, error: 'Reservación no encontrada' }

  return createCheckoutForBooking(company.id, booking, { gratuityPct })
}

// ─── Helper compartido: monto a cobrar (depósito + propina + fee) ─────────────
// Usado por el checkout normal y por el cobro con tarjeta guardada (Sección I,
// capa 3) — misma lógica de negocio, un solo lugar para no duplicarla.

function computeChargeAmounts(
  booking: { total_amount: number | null; currency: string | null; booking_number: string },
  companySettings: unknown,
  gratuityPct: number | undefined,
): {
  currency: string
  mainCents: number
  tipCents: number
  amountCents: number
  feeCents: number
  mainLabel: string
  isDeposit: boolean
  depPct: number
  gratPct: number
} {
  const currency = (booking.currency ?? 'USD').toLowerCase()
  const totalCents = Math.round((booking.total_amount ?? 0) * 100)

  const depPct = depositPct(companySettings)
  const isDeposit = depPct > 0
  const gratPct = isDeposit ? 0 : sanitizeGratuityPct(companySettings, gratuityPct)

  const mainCents = isDeposit ? Math.round(totalCents * (depPct / 100)) : totalCents
  const tipCents = gratPct > 0 ? Math.round(totalCents * (gratPct / 100)) : 0
  const amountCents = mainCents + tipCents

  const mainLabel = isDeposit
    ? `Depósito ${depPct}% — Reservación ${booking.booking_number}`
    : `Reservación ${booking.booking_number}`

  const feePct = platformFeePct(companySettings)
  const feeCents = Math.round(amountCents * (feePct / 100))

  return { currency, mainCents, tipCents, amountCents, feeCents, mainLabel, isDeposit, depPct, gratPct }
}

// ─── Helper compartido: crear Checkout Session ────────────────────────────────

async function createCheckoutForBooking(
  companyId: string,
  booking: {
    id: string
    booking_number: string
    status: string
    total_amount: number | null
    currency: string | null
    passenger_email: string | null
    passenger_name: string | null
  },
  opts?: { gratuityPct?: number },
): Promise<ActionResult<{ url: string }>> {
  if (!booking.total_amount || booking.total_amount <= 0) {
    return { success: false, error: 'La reservación no tiene monto a cobrar' }
  }
  if (['cancelled', 'no_show', 'failed'].includes(booking.status)) {
    return { success: false, error: 'No se puede cobrar una reservación cancelada' }
  }

  const admin = createAdminClient()

  // Evitar doble cobro: ¿ya hay un pago exitoso?
  const { data: existing } = await admin
    .from('payments')
    .select('id, status')
    .eq('booking_id', booking.id)
    .in('status', ['succeeded', 'processing'])
    .limit(1)

  if (existing?.length) {
    return { success: false, error: 'Esta reservación ya tiene un pago registrado' }
  }

  const { data: company } = await admin
    .from('companies')
    .select(
      'stripe_connect_account_id, stripe_connect_onboarded, settings, whop_connect_company_id, whop_connect_onboarded, active_payment_provider',
    )
    .eq('id', companyId)
    .single()

  const { currency, mainCents, tipCents, amountCents, feeCents, mainLabel, isDeposit, depPct, gratPct } =
    computeChargeAmounts(booking, company?.settings, opts?.gratuityPct)

  // Destination charge si la empresa completó Connect onboarding
  const useConnect = Boolean(
    company?.stripe_connect_account_id && company?.stripe_connect_onboarded,
  )
  const useWhop = Boolean(
    company?.active_payment_provider === 'whop' &&
      company?.whop_connect_company_id &&
      company?.whop_connect_onboarded,
  )

  // Registrar pago pendiente ANTES de crear la sesión (idempotencia vía metadata)
  const { data: payment, error: payErr } = await admin
    .from('payments')
    .insert({
      company_id: companyId,
      booking_id: booking.id,
      amount: amountCents / 100,
      currency: currency.toUpperCase(),
      platform_fee: feeCents / 100,
      net_amount: (amountCents - feeCents) / 100,
      status: 'pending',
      payment_method: 'card',
      description: isDeposit
        ? `Depósito ${depPct}% de booking ${booking.booking_number}`
        : `Booking ${booking.booking_number}${gratPct > 0 ? ` (incl. propina ${gratPct}%)` : ''}`,
      stripe_connect_account_id: useConnect ? company!.stripe_connect_account_id : null,
    })
    .select('id')
    .single()

  if (payErr || !payment) {
    console.error('[createCheckoutForBooking] payment insert', payErr)
    return { success: false, error: 'Error al registrar el pago' }
  }

  // ── Whop: un solo precio (main + propina combinados) — sin line items ──────
  if (useWhop) {
    const result = await createWhopCheckout({
      whopConnectCompanyId: company!.whop_connect_company_id!,
      amountCents,
      feeCents,
      currency,
      title: `${mainLabel}${gratPct > 0 ? ` (incl. propina ${gratPct}%)` : ''}`,
      productExternalId: `luxeride-booking-${companyId}`,
      productTitle: 'Reservaciones LuxeRide',
      redirectUrl: `${APP_URL}/payment/success?booking=${encodeURIComponent(booking.booking_number)}`,
      metadata: {
        payment_id: payment.id,
        booking_id: booking.id,
        company_id: companyId,
        kind: isDeposit ? 'deposit' : 'full',
      },
    })

    if (!result.ok) {
      await admin.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
      return { success: false, error: 'Error al crear el checkout de Whop' }
    }

    await admin
      .from('payments')
      .update({ whop_checkout_id: result.checkoutConfigurationId })
      .eq('id', payment.id)

    revalidatePath(`/admin/bookings/${booking.id}`)
    return { success: true, data: { url: result.url } }
  }

  const stripe = getStripe()
  if (!stripe) {
    await admin.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
    return { success: false, error: 'Pagos online no disponibles — Stripe no configurado' }
  }

  try {
    const lineItems: { quantity: number; price_data: { currency: string; unit_amount: number; product_data: { name: string; description?: string } } }[] = [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: mainCents,
          product_data: {
            name: mainLabel,
            description: booking.passenger_name
              ? `Pasajero: ${booking.passenger_name}`
              : undefined,
          },
        },
      },
    ]
    if (tipCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: tipCents,
          product_data: { name: `Propina (${gratPct}%)` },
        },
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: booking.passenger_email ?? undefined,
      line_items: lineItems,
      payment_intent_data: useConnect
        ? {
            transfer_data: { destination: company!.stripe_connect_account_id! },
            application_fee_amount: feeCents > 0 ? feeCents : undefined,
            metadata: { payment_id: payment.id, booking_id: booking.id },
          }
        : { metadata: { payment_id: payment.id, booking_id: booking.id } },
      metadata: {
        payment_id: payment.id,
        booking_id: booking.id,
        company_id: companyId,
        kind: isDeposit ? 'deposit' : 'full',
        gratuity_pct: String(gratPct),
        gratuity_cents: String(tipCents),
      },
      success_url: `${APP_URL}/payment/success?booking=${encodeURIComponent(booking.booking_number)}`,
      cancel_url: `${APP_URL}/payment/cancelled?booking=${encodeURIComponent(booking.booking_number)}`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
    })

    await admin
      .from('payments')
      .update({ metadata: { checkout_session_id: session.id } })
      .eq('id', payment.id)

    revalidatePath(`/admin/bookings/${booking.id}`)
    return { success: true, data: { url: session.url! } }
  } catch (err) {
    console.error('[createCheckoutForBooking] stripe error', err)
    // Limpiar el pago pendiente que no llegó a tener sesión
    await admin.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
    return { success: false, error: 'Error al crear la sesión de pago' }
  }
}

// ─── Pago manual (cash / Zelle / transferencia) ───────────────────────────────
// Para cobros fuera de Stripe: el staff registra el pago recibido y queda
// auditado en payments (el trigger de audit_logs lo captura).

const MANUAL_METHOD_LABELS: Record<string, 'cash' | 'bank_transfer'> = {
  cash: 'cash',
  zelle: 'bank_transfer',
  bank_transfer: 'bank_transfer',
}

export async function recordManualPaymentAction(params: {
  bookingId: string
  method: string // 'cash' | 'zelle' | 'bank_transfer'
  amount: number
  reference?: string
}): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin', 'accounting', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const method = MANUAL_METHOD_LABELS[params.method]
  if (!method) return { success: false, error: 'Método de pago inválido' }

  const amount = Math.round(Number(params.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Monto inválido' }
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, status, total_amount, currency, company_id')
    .eq('id', params.bookingId)
    .eq('company_id', user.company_id)
    .single()

  if (!booking) return { success: false, error: 'Reservación no encontrada' }
  if (['cancelled', 'no_show', 'failed'].includes(booking.status)) {
    return { success: false, error: 'No se puede registrar pago en una reservación cancelada' }
  }

  // Tope sano: hasta 2x el total (cubre propinas/extras) para evitar typos
  const total = Number(booking.total_amount ?? 0)
  if (total > 0 && amount > total * 2) {
    return { success: false, error: `El monto excede el doble del total ($${total.toFixed(2)})` }
  }

  const methodLabel =
    params.method === 'zelle' ? 'Zelle' : params.method === 'cash' ? 'Efectivo' : 'Transferencia'
  const reference = params.reference?.trim().slice(0, 120)

  const { error } = await admin.from('payments').insert({
    company_id: user.company_id,
    booking_id: booking.id,
    amount,
    currency: booking.currency ?? 'USD',
    status: 'succeeded',
    payment_method: method,
    description: `${methodLabel} — Booking ${booking.booking_number}${reference ? ` (ref: ${reference})` : ''} — registrado por staff`,
    captured_at: new Date().toISOString(),
    metadata: { manual: true, method: params.method, reference: reference ?? null, recorded_by: user.id },
  })

  if (error) {
    console.error('[recordManualPaymentAction]', error)
    return { success: false, error: 'Error al registrar el pago' }
  }

  revalidatePath(`/admin/bookings/${booking.id}`)
  return { success: true }
}

// ─── Reembolso ────────────────────────────────────────────────────────────────

export async function refundPaymentAction(
  paymentId: string,
  reason?: string,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin', 'accounting')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: payment } = await admin
    .from('payments')
    .select('id, booking_id, company_id, amount, status, stripe_payment_intent_id, whop_payment_id')
    .eq('id', paymentId)
    .eq('company_id', user.company_id)
    .single()

  if (!payment) return { success: false, error: 'Pago no encontrado' }
  if (payment.status !== 'succeeded') {
    return { success: false, error: 'Solo pagos exitosos pueden reembolsarse' }
  }

  // ── Reembolso vía Whop ──────────────────────────────────────────────────────
  if (payment.whop_payment_id) {
    const whop = getWhopClient()
    if (!whop) return { success: false, error: 'Whop no está configurado' }

    try {
      // El SDK devuelve el Payment actualizado, no un Refund con ID propio —
      // el webhook refund.created rellena refunds.whop_refund_id cuando llegue.
      await whop.payments.refund(payment.whop_payment_id, {})

      await admin.from('refunds').insert({
        company_id: payment.company_id,
        payment_id: payment.id,
        booking_id: payment.booking_id,
        amount: payment.amount,
        reason: reason?.trim() || 'requested_by_customer',
        status: 'pending',
        initiated_by: user.id,
      })

      await admin.from('payments').update({ status: 'refunded' }).eq('id', payment.id)

      if (payment.booking_id) revalidatePath(`/admin/bookings/${payment.booking_id}`)
      return { success: true }
    } catch (err) {
      console.error('[refundPaymentAction] whop', err)
      return { success: false, error: 'Error al procesar el reembolso con Whop' }
    }
  }

  // ── Reembolso vía Stripe ─────────────────────────────────────────────────────
  const stripe = getStripe()
  if (!stripe) return { success: false, error: 'Stripe no está configurado' }
  if (!payment.stripe_payment_intent_id) {
    return { success: false, error: 'Pago sin PaymentIntent de Stripe' }
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      reason: 'requested_by_customer',
      metadata: { payment_id: payment.id, initiated_by: user.id },
    })

    await admin.from('refunds').insert({
      company_id: payment.company_id,
      payment_id: payment.id,
      booking_id: payment.booking_id,
      stripe_refund_id: refund.id,
      amount: payment.amount,
      reason: reason?.trim() || 'requested_by_customer',
      status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
      initiated_by: user.id,
    })

    await admin
      .from('payments')
      .update({ status: 'refunded' })
      .eq('id', payment.id)

    if (payment.booking_id) revalidatePath(`/admin/bookings/${payment.booking_id}`)
    return { success: true }
  } catch (err) {
    console.error('[refundPaymentAction]', err)
    return { success: false, error: 'Error al procesar el reembolso' }
  }
}

// ─── Sección I, capa 3: tarjeta guardada vía Whop ──────────────────────────────
// El bookingId (UUID no adivinable) es el capability token — el mismo patrón
// de seguridad que ya usa /track/[id] en todo el proyecto. No se expone ningún
// endpoint que acepte un teléfono libre para esto.

export interface SavedWhopCard {
  last4: string | null
  brand: string | null
}

// ¿Este pasajero (por el teléfono de ESTA reserva) tiene una tarjeta guardada
// de un pago anterior con la misma empresa vía Whop?
export async function getSavedWhopCardAction(
  bookingId: string,
): Promise<{ found: boolean; card?: SavedWhopCard }> {
  if (!UUID_RE.test(bookingId)) return { found: false }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('company_id, passenger_phone')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking?.passenger_phone) return { found: false }

  const { data: member } = await admin
    .from('passenger_whop_members')
    .select('whop_member_id')
    .eq('company_id', booking.company_id)
    .eq('phone', booking.passenger_phone.trim())
    .maybeSingle()
  if (!member) return { found: false }

  const { data: company } = await admin
    .from('companies')
    .select('whop_connect_company_id, active_payment_provider, whop_connect_onboarded')
    .eq('id', booking.company_id)
    .single()
  if (
    !company?.whop_connect_company_id ||
    company.active_payment_provider !== 'whop' ||
    !company.whop_connect_onboarded
  ) {
    return { found: false }
  }

  const client = getWhopClient()
  if (!client) return { found: false }

  try {
    const page = await client.paymentMethods.list({
      member_id: member.whop_member_id,
      company_id: company.whop_connect_company_id,
    })
    const card = page.data.find(
      (m): m is Extract<typeof m, { typename: 'CardPaymentMethod' }> => m.typename === 'CardPaymentMethod',
    )
    if (!card) return { found: false }
    return { found: true, card: { last4: card.card.last4, brand: card.card.brand } }
  } catch (err) {
    console.error('[getSavedWhopCardAction]', err)
    return { found: false }
  }
}

// Cobra el viaje con la tarjeta guardada (sin redirigir a un checkout nuevo).
// Reutiliza exactamente el mismo cálculo de monto y el mismo flujo de webhook
// (payment.succeeded actualiza el registro `payments` por metadata.payment_id)
// que el checkout normal — la única diferencia es el método de cobro.
export async function chargeWithSavedWhopCardAction(
  bookingId: string,
  gratuityPct?: number,
): Promise<ActionResult> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  if (!(await checkRateLimit('saved_card_charge', 5))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, status, total_amount, currency, passenger_phone, company_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return { success: false, error: 'Reservación no encontrada' }
  if (!booking.total_amount || booking.total_amount <= 0) {
    return { success: false, error: 'La reservación no tiene monto a cobrar' }
  }
  if (['cancelled', 'no_show', 'failed'].includes(booking.status)) {
    return { success: false, error: 'No se puede cobrar una reservación cancelada' }
  }
  if (!booking.passenger_phone) return { success: false, error: 'Sin teléfono en la reserva' }

  const { data: existing } = await admin
    .from('payments')
    .select('id')
    .eq('booking_id', booking.id)
    .in('status', ['succeeded', 'processing'])
    .limit(1)
  if (existing?.length) return { success: false, error: 'Esta reservación ya tiene un pago registrado' }

  const { data: member } = await admin
    .from('passenger_whop_members')
    .select('whop_member_id')
    .eq('company_id', booking.company_id)
    .eq('phone', booking.passenger_phone.trim())
    .maybeSingle()
  if (!member) return { success: false, error: 'No hay tarjeta guardada para este pasajero' }

  const { data: company } = await admin
    .from('companies')
    .select('whop_connect_company_id, active_payment_provider, whop_connect_onboarded, settings')
    .eq('id', booking.company_id)
    .single()
  if (
    !company?.whop_connect_company_id ||
    company.active_payment_provider !== 'whop' ||
    !company.whop_connect_onboarded
  ) {
    return { success: false, error: 'Pagos con Whop no disponibles para esta empresa' }
  }

  const client = getWhopClient()
  if (!client) return { success: false, error: 'Whop no está configurado' }

  const page = await client.paymentMethods
    .list({ member_id: member.whop_member_id, company_id: company.whop_connect_company_id })
    .catch(() => null)
  const card = page?.data.find((m) => m.typename === 'CardPaymentMethod')
  if (!card) return { success: false, error: 'No se encontró la tarjeta guardada en Whop' }

  const { currency, amountCents, feeCents, mainLabel, isDeposit, gratPct } =
    computeChargeAmounts(booking, company.settings, gratuityPct)

  const { data: payment, error: payErr } = await admin
    .from('payments')
    .insert({
      company_id: booking.company_id,
      booking_id: booking.id,
      amount: amountCents / 100,
      currency: currency.toUpperCase(),
      platform_fee: feeCents / 100,
      net_amount: (amountCents - feeCents) / 100,
      status: 'pending',
      payment_method: 'card',
      description: `${mainLabel}${gratPct > 0 ? ` (incl. propina ${gratPct}%)` : ''} — tarjeta guardada`,
    })
    .select('id')
    .single()
  if (payErr || !payment) {
    console.error('[chargeWithSavedWhopCardAction] payment insert', payErr)
    return { success: false, error: 'Error al registrar el pago' }
  }

  try {
    await client.payments.create({
      company_id: company.whop_connect_company_id,
      member_id: member.whop_member_id,
      payment_method_id: card.id,
      plan: {
        currency: currency as never,
        initial_price: amountCents / 100,
        application_fee_amount: feeCents > 0 ? feeCents / 100 : undefined,
        plan_type: 'one_time',
        title: mainLabel,
        product: {
          external_identifier: `luxeride-booking-${booking.company_id}`,
          title: 'Reservaciones LuxeRide',
        },
      },
      metadata: {
        payment_id: payment.id,
        booking_id: booking.id,
        company_id: booking.company_id,
        kind: isDeposit ? 'deposit' : 'full',
      },
    })
  } catch (err) {
    console.error('[chargeWithSavedWhopCardAction]', err)
    await admin.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
    return { success: false, error: 'No se pudo procesar el cobro con la tarjeta guardada' }
  }

  revalidatePath(`/admin/bookings/${booking.id}`)
  return { success: true }
}
