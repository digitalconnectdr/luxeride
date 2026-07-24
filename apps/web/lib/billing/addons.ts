// ── Add-ons de pago genéricos ──────────────────────────────────────────────────
// Generalización del patrón usado por el add-on de Red de Afiliados (Sección G,
// ver lib/billing/whop.ts → isAffiliateAddonPlan) para los 3 add-ons nuevos:
// nómina de conductores, firma electrónica, códigos promocionales. En vez de
// repetir un booleano + timestamp + membership_id por cada uno en `companies`
// (como se hizo con affiliate_network_enabled), el estado vive en una sola
// tabla `company_addons` (company_id, addon_key, enabled, ...).
//
// Diferencia deliberada respecto al add-on de afiliados: ahí "incluido en
// Elite/Enterprise" es una CONVENCIÓN MANUAL (el super-admin debe recordar
// activar el flag también en esas cuentas). Aquí, para no repetir ese mismo
// trabajo manual x3, `isAddonActive()` compara el plan automáticamente — un
// upgrade a Elite/Enterprise activa el add-on sin que nadie tenga que tocar
// un toggle.

import type { CompanyPlan } from '@/lib/supabase/database.types'
import { resolveAiChatTierAddonKeyForPlanId } from '@/lib/billing/ai-chat-addon'
import { resolveAiGrowthTierAddonKeyForPlanId } from '@/lib/billing/ai-growth-addon'
import { resolveCustomDomainAddonKeyForPlanId } from '@/lib/billing/custom-domain-addon'

export type AddonKey = 'driver_payroll' | 'esignature' | 'promo_codes'

export const ADDON_KEYS: readonly AddonKey[] = ['driver_payroll', 'esignature', 'promo_codes']

/** Precio mensual del add-on para planes Starter/Professional (USD). */
export const ADDON_MONTHLY_PRICE: Record<AddonKey, number> = {
  driver_payroll: 9,
  esignature: 9,
  promo_codes: 3,
}

const ADDON_ENV_PREFIX: Record<AddonKey, string> = {
  driver_payroll: 'PAYROLL',
  esignature: 'ESIGNATURE',
  promo_codes: 'PROMO_CODES',
}

/** Nombre exacto de la env var con el plan_id de Whop de este add-on. */
export function addonPlanIdEnvVar(addonKey: AddonKey): string {
  return `WHOP_PLAN_ID_${ADDON_ENV_PREFIX[addonKey]}_ADDON`
}

/** Nombre exacto de la env var con la URL de checkout de Whop de este add-on. */
export function addonCheckoutUrlEnvVar(addonKey: AddonKey): string {
  return `WHOP_CHECKOUT_URL_${ADDON_ENV_PREFIX[addonKey]}_ADDON`
}

export function getAddonCheckoutUrl(addonKey: AddonKey): string | undefined {
  return process.env[addonCheckoutUrlEnvVar(addonKey)]
}

export function isAddonPlanId(addonKey: AddonKey, whopPlanId: string | null): boolean {
  if (!whopPlanId) return false
  const configured = process.env[addonPlanIdEnvVar(addonKey)]
  return !!configured && whopPlanId === configured
}

/**
 * ¿A cuál add-on (si alguno) corresponde este plan_id de Whop? Para el webhook.
 * Devuelve `string` (no `AddonKey`) porque también reconoce los tiers del
 * add-on de Asistente de IA (ai_chat_basic/ai_chat_plus, ver
 * lib/billing/ai-chat-addon.ts) — esos NO son un AddonKey a propósito, para
 * que no hereden el auto-incluido-en-Elite/Enterprise de isAddonActive(). El
 * webhook (app/api/webhooks/whop/route.ts) los activa/desactiva igual que
 * cualquier otro addon genérico, porque `company_addons.addon_key` ya es TEXT
 * libre — no hace falta tocar ese archivo.
 */
export function resolveAddonKeyForPlanId(whopPlanId: string | null): string | null {
  for (const key of ADDON_KEYS) {
    if (isAddonPlanId(key, whopPlanId)) return key
  }
  return (
    resolveAiChatTierAddonKeyForPlanId(whopPlanId) ??
    resolveAiGrowthTierAddonKeyForPlanId(whopPlanId) ??
    resolveCustomDomainAddonKeyForPlanId(whopPlanId)
  )
}

/** Incluido automáticamente en Elite/Enterprise — sin togglear nada a mano. */
export function isAddonIncludedInPlan(plan: CompanyPlan): boolean {
  return plan === 'elite' || plan === 'enterprise'
}

/** ¿Está activo el add-on para esta empresa? (incluido por plan, o comprado aparte) */
export function isAddonActive(plan: CompanyPlan, addonEnabled: boolean): boolean {
  return isAddonIncludedInPlan(plan) || addonEnabled
}
