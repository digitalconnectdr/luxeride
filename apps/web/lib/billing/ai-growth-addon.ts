// ── Add-on: AI Growth Assistant ────────────────────────────────────────────────
// Deliberadamente separado de lib/billing/addons.ts, mismo motivo que
// lib/billing/ai-chat-addon.ts: este addon tiene costo variable real (tokens
// de OpenAI por generacion), asi que nunca se regala por plan — siempre
// requiere activacion explicita (Whop, o un toggle manual del super-admin).
//
// Empaqueta 2 features bajo una sola cuota de "generaciones de IA al mes":
// seguimiento de cotizaciones con IA (automatico, via el cron existente) y
// generador de contenido de marketing bajo demanda (posts para redes/Google
// Business). Precio mas bajo que AI Chat Assistant porque cada generacion es
// una respuesta unica, no una conversacion completa de varios turnos.

export type AiGrowthTier = 'basic' | 'plus'

export const AI_GROWTH_TIERS: readonly AiGrowthTier[] = ['basic', 'plus']

/** Precio mensual del tier (USD). */
export const AI_GROWTH_TIER_PRICE: Record<AiGrowthTier, number> = {
  basic: 9,
  plus: 19,
}

/** Generaciones de IA incluidas por mes antes de excedente. */
export const AI_GROWTH_TIER_QUOTA: Record<AiGrowthTier, number> = {
  basic: 150,
  plus: 500,
}

/** Precio del excedente, por cada bloque de 50 generaciones extra. */
export const AI_GROWTH_OVERAGE_PRICE_PER_50 = 3

export function aiGrowthAddonKey(tier: AiGrowthTier): `ai_growth_${AiGrowthTier}` {
  return `ai_growth_${tier}`
}

export function isAiGrowthAddonKey(key: string): key is `ai_growth_${AiGrowthTier}` {
  return key === 'ai_growth_basic' || key === 'ai_growth_plus'
}

export function tierFromAiGrowthAddonKey(key: string): AiGrowthTier | null {
  if (key === 'ai_growth_basic') return 'basic'
  if (key === 'ai_growth_plus') return 'plus'
  return null
}

const ADDON_ENV_PREFIX: Record<AiGrowthTier, string> = {
  basic: 'AI_GROWTH_BASIC',
  plus: 'AI_GROWTH_PLUS',
}

export function aiGrowthPlanIdEnvVar(tier: AiGrowthTier): string {
  return `WHOP_PLAN_ID_${ADDON_ENV_PREFIX[tier]}_ADDON`
}

export function aiGrowthCheckoutUrlEnvVar(tier: AiGrowthTier): string {
  return `WHOP_CHECKOUT_URL_${ADDON_ENV_PREFIX[tier]}_ADDON`
}

export function getAiGrowthCheckoutUrl(tier: AiGrowthTier): string | undefined {
  return process.env[aiGrowthCheckoutUrlEnvVar(tier)]
}

/** ¿A cual tier (si alguno) corresponde este plan_id de Whop? Para el webhook. */
export function resolveAiGrowthTierAddonKeyForPlanId(whopPlanId: string | null): `ai_growth_${AiGrowthTier}` | null {
  if (!whopPlanId) return null
  for (const tier of AI_GROWTH_TIERS) {
    const configured = process.env[aiGrowthPlanIdEnvVar(tier)]
    if (configured && whopPlanId === configured) return aiGrowthAddonKey(tier)
  }
  return null
}
