import { getWhopClient } from './connect-server'

/**
 * Whop Connect — Fase 2: cobro real por viaje.
 *
 * A diferencia de Stripe Checkout (line items + cents), un
 * checkout-configuration de Whop tiene UN SOLO precio (`plan.initial_price`,
 * en dólares decimales, no centavos) — por eso el llamador debe combinar
 * cualquier propina en el monto total antes de invocar esto. `purchase_url`
 * en la respuesta es una ruta relativa (`/checkout/plan_xxx?session=...`);
 * aquí se resuelve a absoluta.
 */
export async function createWhopCheckout(params: {
  whopConnectCompanyId: string
  amountCents: number
  feeCents: number
  currency: string
  title: string
  productExternalId: string
  productTitle: string
  redirectUrl: string
  metadata: Record<string, string>
}): Promise<{ ok: true; checkoutConfigurationId: string; url: string } | { ok: false }> {
  const client = getWhopClient()
  if (!client) return { ok: false }

  try {
    const config = await client.checkoutConfigurations.create({
      plan: {
        company_id: params.whopConnectCompanyId,
        currency: params.currency as never,
        plan_type: 'one_time',
        initial_price: Math.round(params.amountCents) / 100,
        application_fee_amount: params.feeCents > 0 ? Math.round(params.feeCents) / 100 : undefined,
        title: params.title,
        product: {
          external_identifier: params.productExternalId,
          title: params.productTitle,
        },
      },
      metadata: params.metadata,
      redirect_url: params.redirectUrl,
    })

    const url = config.purchase_url.startsWith('http')
      ? config.purchase_url
      : `https://whop.com${config.purchase_url}`

    return { ok: true, checkoutConfigurationId: config.id, url }
  } catch (err) {
    console.error('[createWhopCheckout]', err)
    return { ok: false }
  }
}

/**
 * Checkout en modo "setup" (@whop/sdk `CheckoutModes = 'payment' | 'setup'`):
 * guarda una tarjeta para uso futuro SIN cobrar nada ahora (Whop cobra $0 en
 * este flujo — confirmado contra docs.whop.com/developer/guides/save-
 * payment-methods, no es una suposición). Se usa cuando el pasajero elige
 * "Tarjeta al finalizar" en la app y todavía no tiene ninguna tarjeta en
 * archivo — sin esto no habría forma de cobrar el viaje al terminar.
 *
 * El webhook `setup_intent.succeeded` (whop-connect/route.ts) es quien
 * finalmente guarda el member_id en passenger_whop_members, usando el
 * `metadata` que se manda aquí (company_id + phone — NO booking_id, porque
 * en este punto la reserva todavía no existe).
 */
export async function createWhopSetupCheckout(params: {
  whopConnectCompanyId: string
  redirectUrl: string
  metadata: Record<string, string>
}): Promise<{ ok: true; url: string } | { ok: false }> {
  const client = getWhopClient()
  if (!client) return { ok: false }

  try {
    const config = await client.checkoutConfigurations.create({
      mode: 'setup',
      company_id: params.whopConnectCompanyId,
      metadata: params.metadata,
      redirect_url: params.redirectUrl,
    })

    const url = config.purchase_url.startsWith('http')
      ? config.purchase_url
      : `https://whop.com${config.purchase_url}`

    return { ok: true, url }
  } catch (err) {
    console.error('[createWhopSetupCheckout]', err)
    return { ok: false }
  }
}
