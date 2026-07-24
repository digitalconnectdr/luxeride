// ── Catálogo de add-ons — fuente única para la tienda (marketplace) y el sidebar ──
// Unifica lo que ya vive disperso en addons.ts / ai-chat-addon.ts /
// ai-growth-addon.ts / whop.ts (precio, tiers, env vars de checkout) con la
// metadata de presentación (ícono, ruta, cómo saber si está activo) para que
// la tienda y el menú lateral lean siempre del mismo lugar y nunca se
// desincronicen. No duplica pricing/env vars — solo los referencia.

import {
  Wallet,
  FileSignature,
  Percent,
  Bot,
  TrendingUp,
  Handshake,
  Globe,
  type LucideIcon,
} from 'lucide-react'
import type { CompanyPlan } from '@/lib/supabase/database.types'
import {
  ADDON_MONTHLY_PRICE,
  isAddonActive,
  getAddonCheckoutUrl,
} from '@/lib/billing/addons'
import {
  AI_CHAT_TIERS,
  AI_CHAT_TIER_PRICE,
  AI_CHAT_TIER_QUOTA,
  aiChatAddonKey,
  getAiChatCheckoutUrl,
  type AiChatTier,
} from '@/lib/billing/ai-chat-addon'
import {
  AI_GROWTH_TIERS,
  AI_GROWTH_TIER_PRICE,
  AI_GROWTH_TIER_QUOTA,
  aiGrowthAddonKey,
  getAiGrowthCheckoutUrl,
  type AiGrowthTier,
} from '@/lib/billing/ai-growth-addon'
import {
  CUSTOM_DOMAIN_ADDON_KEY,
  CUSTOM_DOMAIN_MONTHLY_PRICE,
  getCustomDomainCheckoutUrl,
  isCustomDomainAddonActive,
} from '@/lib/billing/custom-domain-addon'

/** Identificador estable de cada servicio en la tienda (no siempre == addon_key de la BD, ver ai_chat/ai_growth que agrupan 2 tiers bajo un solo item). */
export type MarketplaceItemKey =
  | 'driver_payroll'
  | 'esignature'
  | 'promo_codes'
  | 'ai_chat'
  | 'ai_growth'
  | 'affiliate_network'
  | 'custom_domain'

export const MARKETPLACE_ITEM_KEYS: readonly MarketplaceItemKey[] = [
  'driver_payroll',
  'esignature',
  'promo_codes',
  'ai_chat',
  'ai_growth',
  'affiliate_network',
  'custom_domain',
]

export interface MarketplaceTier {
  /** company_addons.addon_key exacto para este tier (o el mismo valor que el item si no tiene tiers). */
  addonKey: string
  /** Sufijo del tier para las etiquetas i18n ('' cuando el item no tiene tiers). */
  tierLabel: '' | 'basic' | 'plus'
  price: number
  quota?: number
  checkoutUrl?: string
}

/** Contexto de una empresa concreta, para resolver "¿esto está activo?" */
export interface MarketplaceActivationContext {
  plan: CompanyPlan
  /** company_addons.addon_key con enabled=true para esta empresa. */
  enabledAddonKeys: Set<string>
  affiliateNetworkEnabled: boolean
}

export interface MarketplaceItem {
  key: MarketplaceItemKey
  icon: LucideIcon
  /** Ruta del admin donde vive la funcionalidad una vez activa. */
  route: string
  /** null = precio variable / requiere contacto (ej. Red de Afiliados). */
  tiers: MarketplaceTier[] | null
  /** ¿Incluido automáticamente en Elite/Enterprise sin pagar aparte? */
  includedInElitePlan: boolean
  /** false = precio variable (comisión por viaje) — la UI nunca debe mostrar un "$X/mes" inventado. */
  hasFixedPrice: boolean
  isActive: (ctx: MarketplaceActivationContext) => boolean
}

function flatTier(addonKey: string, price: number, checkoutUrl: string | undefined): MarketplaceTier[] {
  return [{ addonKey, tierLabel: '', price, checkoutUrl }]
}

export function getMarketplaceItems(): MarketplaceItem[] {
  return [
    {
      key: 'driver_payroll',
      icon: Wallet,
      route: '/admin/payroll',
      tiers: flatTier('driver_payroll', ADDON_MONTHLY_PRICE.driver_payroll, getAddonCheckoutUrl('driver_payroll')),
      includedInElitePlan: true,
      hasFixedPrice: true,
      isActive: ({ plan, enabledAddonKeys }) => isAddonActive(plan, enabledAddonKeys.has('driver_payroll')),
    },
    {
      key: 'esignature',
      icon: FileSignature,
      route: '/admin/esignature',
      tiers: flatTier('esignature', ADDON_MONTHLY_PRICE.esignature, getAddonCheckoutUrl('esignature')),
      includedInElitePlan: true,
      hasFixedPrice: true,
      isActive: ({ plan, enabledAddonKeys }) => isAddonActive(plan, enabledAddonKeys.has('esignature')),
    },
    {
      key: 'promo_codes',
      icon: Percent,
      route: '/admin/promo-codes',
      tiers: flatTier('promo_codes', ADDON_MONTHLY_PRICE.promo_codes, getAddonCheckoutUrl('promo_codes')),
      includedInElitePlan: true,
      hasFixedPrice: true,
      isActive: ({ plan, enabledAddonKeys }) => isAddonActive(plan, enabledAddonKeys.has('promo_codes')),
    },
    {
      key: 'ai_chat',
      icon: Bot,
      route: '/admin/assistant',
      tiers: AI_CHAT_TIERS.map((tier: AiChatTier) => ({
        addonKey: aiChatAddonKey(tier),
        tierLabel: tier,
        price: AI_CHAT_TIER_PRICE[tier],
        quota: AI_CHAT_TIER_QUOTA[tier],
        checkoutUrl: getAiChatCheckoutUrl(tier),
      })),
      includedInElitePlan: false,
      hasFixedPrice: true,
      isActive: ({ enabledAddonKeys }) => AI_CHAT_TIERS.some((t) => enabledAddonKeys.has(aiChatAddonKey(t))),
    },
    {
      key: 'ai_growth',
      icon: TrendingUp,
      route: '/admin/growth-assistant',
      tiers: AI_GROWTH_TIERS.map((tier: AiGrowthTier) => ({
        addonKey: aiGrowthAddonKey(tier),
        tierLabel: tier,
        price: AI_GROWTH_TIER_PRICE[tier],
        quota: AI_GROWTH_TIER_QUOTA[tier],
        checkoutUrl: getAiGrowthCheckoutUrl(tier),
      })),
      includedInElitePlan: false,
      hasFixedPrice: true,
      isActive: ({ enabledAddonKeys }) => AI_GROWTH_TIERS.some((t) => enabledAddonKeys.has(aiGrowthAddonKey(t))),
    },
    {
      key: 'affiliate_network',
      icon: Handshake,
      route: '/admin/affiliates',
      // Sin precio fijo — comisión variable por viaje enviado, ver dict.admin.marketplace.items.affiliate_network.
      tiers: process.env.WHOP_CHECKOUT_URL_AFFILIATE_ADDON
        ? [{ addonKey: 'affiliate_network', tierLabel: '', price: 0, checkoutUrl: process.env.WHOP_CHECKOUT_URL_AFFILIATE_ADDON }]
        : null,
      includedInElitePlan: true,
      hasFixedPrice: false,
      isActive: ({ plan, affiliateNetworkEnabled }) => plan === 'elite' || plan === 'enterprise' || affiliateNetworkEnabled,
    },
    {
      key: 'custom_domain',
      icon: Globe,
      route: '/admin/domain',
      tiers: flatTier(CUSTOM_DOMAIN_ADDON_KEY, CUSTOM_DOMAIN_MONTHLY_PRICE, getCustomDomainCheckoutUrl()),
      // Nunca incluido por plan — ver custom-domain-addon.ts (puede implicar
      // un costo real de renovación de dominio si lo compramos nosotros).
      includedInElitePlan: false,
      hasFixedPrice: true,
      isActive: ({ enabledAddonKeys }) => isCustomDomainAddonActive(enabledAddonKeys),
    },
  ]
}
