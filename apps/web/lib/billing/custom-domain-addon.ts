// ── Add-on: Dominio personalizado ──────────────────────────────────────────────
// Deliberadamente SEPARADO de lib/billing/addons.ts (mismo motivo que
// ai-chat-addon.ts): ese módulo incluye automáticamente cualquier addon en la
// lista gratis para Elite/Enterprise (isAddonIncludedInPlan). Un dominio
// personalizado SÍ puede tener un costo real detrás (si el operador pidió
// "consíganme uno" — ver domain_requests — el super-admin paga la
// renovación anual del registrador), así que nunca se regala por plan:
// siempre requiere activación explícita vía Whop.

export const CUSTOM_DOMAIN_ADDON_KEY = 'custom_domain'

/** Precio mensual (USD) — cubre el servicio (verificación, hosting bajo el
 * dominio, soporte de DNS), no el costo de compra del dominio en sí (ese se
 * paga aparte si el operador pidió que se lo consiguiéramos). */
export const CUSTOM_DOMAIN_MONTHLY_PRICE = 15

export function customDomainPlanIdEnvVar(): string {
  return 'WHOP_PLAN_ID_CUSTOM_DOMAIN_ADDON'
}

export function customDomainCheckoutUrlEnvVar(): string {
  return 'WHOP_CHECKOUT_URL_CUSTOM_DOMAIN_ADDON'
}

export function getCustomDomainCheckoutUrl(): string | undefined {
  return process.env[customDomainCheckoutUrlEnvVar()]
}

export function isCustomDomainAddonPlanId(whopPlanId: string | null): boolean {
  if (!whopPlanId) return false
  const configured = process.env[customDomainPlanIdEnvVar()]
  return Boolean(configured) && whopPlanId === configured
}

/** ¿A este addon corresponde este plan_id de Whop? Para el webhook. */
export function resolveCustomDomainAddonKeyForPlanId(whopPlanId: string | null): typeof CUSTOM_DOMAIN_ADDON_KEY | null {
  return isCustomDomainAddonPlanId(whopPlanId) ? CUSTOM_DOMAIN_ADDON_KEY : null
}

/** Activo solo si se compró explícito — nunca incluido por plan (ver header). */
export function isCustomDomainAddonActive(enabledAddonKeys: Set<string>): boolean {
  return enabledAddonKeys.has(CUSTOM_DOMAIN_ADDON_KEY)
}
