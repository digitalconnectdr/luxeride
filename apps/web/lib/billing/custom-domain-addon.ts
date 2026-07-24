import type { CompanyPlan } from '@/lib/supabase/database.types'

// ── Add-ons de dominio personalizado — DOS servicios distintos ──────────────
// Aclaración de negocio 2026-07-24: conectar un dominio que el operador YA
// TIENE (BYOD) es un trabajo puntual de DNS/verificación — no justifica un
// cobro recurrente, porque LuxeRide no asume ningún costo continuo (el
// dominio lo sigue pagando el operador a su propio registrador). En cambio,
// si el operador NO tiene dominio y pide que se lo consigamos
// (domain_requests), ahí sí hay un costo real y continuo (LuxeRide compra y
// renueva el dominio) que sí justifica un cobro mensual.
//
// Por eso son dos add-ons separados:
// - CUSTOM_DOMAIN_BYOD_ADDON_KEY: pago ÚNICO por conectar un dominio propio.
//   Vive en el mecanismo genérico (company_addons, incluido en Elite/
//   Enterprise) porque no tiene costo variable — una vez pagado, queda
//   activo para siempre (no hay evento de cancelación posible, es una
//   compra de un solo cobro en Whop, no una suscripción).
// - CUSTOM_DOMAIN_ADDON_KEY: cuota MENSUAL por el servicio de "consíganme un
//   dominio" (LuxeRide compra + renueva). Deliberadamente FUERA del
//   mecanismo genérico (mismo motivo que ai-chat-addon.ts): nunca se regala
//   por plan, siempre requiere activación explícita vía Whop.

export const CUSTOM_DOMAIN_ADDON_KEY = 'custom_domain'

/** Precio mensual (USD) del servicio "consíganme un dominio" — cubre que
 * LuxeRide compre y renueve el dominio a nombre del operador. */
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

// ─── BYOD: pago único por conectar un dominio propio ───────────────────────

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

/** A diferencia del servicio de arriba, este SÍ se incluye gratis en Elite/
 * Enterprise — es un trabajo puntual sin costo variable, mismo criterio que
 * nómina/firma electrónica/códigos promocionales (lib/billing/addons.ts). */
export function isCustomDomainByodActive(plan: CompanyPlan, enabledAddonKeys: Set<string>): boolean {
  return plan === 'elite' || plan === 'enterprise' || enabledAddonKeys.has(CUSTOM_DOMAIN_BYOD_ADDON_KEY)
}
