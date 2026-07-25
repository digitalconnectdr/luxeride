import type { CompanyPlan } from '@/lib/supabase/database.types'

// ── Add-on: conectar un dominio propio (BYOD) ───────────────────────────────
// Aclaración de negocio 2026-07-24: conectar un dominio que el operador YA
// TIENE es un trabajo puntual de DNS/verificación — no justifica un cobro
// recurrente, porque LuxeRide no asume ningún costo continuo (el dominio lo
// sigue pagando el operador a su propio registrador). Por eso es un cargo
// ÚNICO, no una suscripción.
//
// El otro camino ("consíganme un dominio", el operador no tiene y pide que
// se lo consigamos) NO tiene un addon de Whop — se decidió (2026-07-24,
// tras construir el sistema de cargos adicionales) que el costo real de un
// dominio varía demasiado por disponibilidad para tener un precio fijo. Ese
// camino es 100% manual: domain_requests (gratis, sin gate) → el super-admin
// compra y conecta (resolveDomainRequestAction) → crea un cargo con el
// precio REAL acordado vía company_extra_charges (ver
// app/actions/company-billing.ts), que se cobra automáticamente después.

export const CUSTOM_DOMAIN_BYOD_ADDON_KEY = 'custom_domain_byod'

/** Cargo ÚNICO (USD) — no mensual. Cubre el soporte de configuración/DNS. */
export const CUSTOM_DOMAIN_BYOD_SETUP_FEE = 29

export function customDomainByodPlanIdEnvVar(): string {
  return 'WHOP_PLAN_ID_CUSTOM_DOMAIN_BYOD'
}

export function customDomainByodCheckoutUrlEnvVar(): string {
  return 'WHOP_CHECKOUT_URL_CUSTOM_DOMAIN_BYOD'
}

export function getCustomDomainByodCheckoutUrl(): string | undefined {
  return process.env[customDomainByodCheckoutUrlEnvVar()]
}

export function isCustomDomainByodPlanId(whopPlanId: string | null): boolean {
  if (!whopPlanId) return false
  const configured = process.env[customDomainByodPlanIdEnvVar()]
  return Boolean(configured) && whopPlanId === configured
}

/** ¿A este addon corresponde este plan_id de Whop? Para el webhook. */
export function resolveCustomDomainByodAddonKeyForPlanId(whopPlanId: string | null): typeof CUSTOM_DOMAIN_BYOD_ADDON_KEY | null {
  return isCustomDomainByodPlanId(whopPlanId) ? CUSTOM_DOMAIN_BYOD_ADDON_KEY : null
}

/** Sí se incluye gratis en Elite/Enterprise — es un trabajo puntual sin
 * costo variable, mismo criterio que nómina/firma electrónica/códigos
 * promocionales (lib/billing/addons.ts). */
export function isCustomDomainByodActive(plan: CompanyPlan, enabledAddonKeys: Set<string>): boolean {
  return plan === 'elite' || plan === 'enterprise' || enabledAddonKeys.has(CUSTOM_DOMAIN_BYOD_ADDON_KEY)
}
