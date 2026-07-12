// ── Add-on: Asistente de IA por micrositio ─────────────────────────────────────
// Deliberadamente SEPARADO de lib/billing/addons.ts: ese modulo incluye
// automaticamente cualquier addon en la lista gratis para Elite/Enterprise
// (isAddonIncludedInPlan), lo cual tiene sentido para features de costo fijo
// (nomina, firma, promo codes). Este addon SI tiene costo variable real
// (tokens de OpenAI por conversacion), asi que nunca se regala por plan -
// siempre requiere una activacion explicita (Whop, o un toggle manual del
// super-admin para casos Enterprise negociados a mano).
//
// Dos tiers en vez de un precio fijo, ancorados a lo que cobra el mas barato
// de la competencia (Botpress Plus: 250 conversaciones/mes por $150/mes):
// aqui Basico ya duplica esa cuota por una fraccion del precio, gracias a que
// el costo real por conversacion con GPT-4o-mini es de centavos, no de $0.65.

export type AiChatTier = 'basic' | 'plus'

export const AI_CHAT_TIERS: readonly AiChatTier[] = ['basic', 'plus']

/** Precio mensual del tier (USD). */
export const AI_CHAT_TIER_PRICE: Record<AiChatTier, number> = {
  basic: 15,
  plus: 29,
}

/** Conversaciones incluidas por mes antes de excedente. */
export const AI_CHAT_TIER_QUOTA: Record<AiChatTier, number> = {
  basic: 400,
  plus: 1000,
}

/** Precio del excedente, por cada bloque de 100 conversaciones extra. */
export const AI_CHAT_OVERAGE_PRICE_PER_100 = 5

/** company_addons.addon_key para cada tier. */
export function aiChatAddonKey(tier: AiChatTier): `ai_chat_${AiChatTier}` {
  return `ai_chat_${tier}`
}

export function isAiChatAddonKey(key: string): key is `ai_chat_${AiChatTier}` {
  return key === 'ai_chat_basic' || key === 'ai_chat_plus'
}

export function tierFromAddonKey(key: string): AiChatTier | null {
  if (key === 'ai_chat_basic') return 'basic'
  if (key === 'ai_chat_plus') return 'plus'
  return null
}

const ADDON_ENV_PREFIX: Record<AiChatTier, string> = {
  basic: 'AI_CHAT_BASIC',
  plus: 'AI_CHAT_PLUS',
}

export function aiChatPlanIdEnvVar(tier: AiChatTier): string {
  return `WHOP_PLAN_ID_${ADDON_ENV_PREFIX[tier]}_ADDON`
}

export function aiChatCheckoutUrlEnvVar(tier: AiChatTier): string {
  return `WHOP_CHECKOUT_URL_${ADDON_ENV_PREFIX[tier]}_ADDON`
}

export function getAiChatCheckoutUrl(tier: AiChatTier): string | undefined {
  return process.env[aiChatCheckoutUrlEnvVar(tier)]
}

/** ¿A cual tier (si alguno) corresponde este plan_id de Whop? Para el webhook. */
export function resolveAiChatTierAddonKeyForPlanId(whopPlanId: string | null): `ai_chat_${AiChatTier}` | null {
  if (!whopPlanId) return null
  for (const tier of AI_CHAT_TIERS) {
    const configured = process.env[aiChatPlanIdEnvVar(tier)]
    if (configured && whopPlanId === configured) return aiChatAddonKey(tier)
  }
  return null
}
