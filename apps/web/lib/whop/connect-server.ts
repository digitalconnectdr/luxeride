import Whop from '@whop/sdk'

/**
 * Whop Connect — servidor únicamente. Segundo riel de pago (junto a Stripe
 * Connect) para que los operadores cobren a sus pasajeros.
 *
 * Requiere dos variables de entorno:
 * - WHOP_API_KEY: key con permisos amplios (Company, Account Links,
 *   Checkout configurations, Payments, Payouts, Transfers) — NO la misma
 *   key de solo "Webhook Receive" usada en la Parte A (facturación de
 *   LuxeRide). Ver docs.whop.com/developer/platforms.
 * - WHOP_PARENT_COMPANY_ID: el ID de la cuenta de Whop de la plataforma
 *   (biz_xxxxxxxxxxxxxx) — bajo la cual se crean las sub-cuentas conectadas.
 *
 * IMPORTANTE: los campos/nombres de método aquí SÍ están verificados contra
 * los tipos reales de @whop/sdk (node_modules/@whop/sdk/resources/*.d.ts) y
 * la documentación oficial (docs.whop.com/developer/platforms) — no son una
 * suposición como en partes anteriores de esta integración. Lo que SIGUE sin
 * verificar en vivo es si `company.verified` refleja de forma confiable que
 * el onboarding/KYC está completo y la cuenta puede recibir pagos — Whop no
 * expone un campo tipo `charges_enabled`/`payouts_enabled` explícito como
 * Stripe. Verificar con un onboarding real antes de confiar en esto para
 * decidir cuándo mostrar la opción de cobrar vía Whop a los pasajeros.
 */

let clientSingleton: Whop | null | undefined

export function isWhopConnectConfigured(): boolean {
  return !!process.env.WHOP_API_KEY && !!process.env.WHOP_PARENT_COMPANY_ID
}

export function getWhopClient(): Whop | null {
  if (clientSingleton !== undefined) return clientSingleton
  if (!isWhopConnectConfigured()) {
    clientSingleton = null
    return null
  }
  clientSingleton = new Whop({ apiKey: process.env.WHOP_API_KEY! })
  return clientSingleton
}

export function getWhopParentCompanyId(): string {
  return process.env.WHOP_PARENT_COMPANY_ID!
}
