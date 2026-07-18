import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { getMarketplaceItems } from '@/lib/billing/catalog'
import { MarketplaceGrid, type MarketplaceCardData } from '@/components/admin/marketplace/marketplace-grid'

export function generateMetadata(): Metadata {
  return { title: getDict().admin.marketplace.title }
}

export default async function MarketplacePage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const [{ data: company }, { data: addonRows }] = await Promise.all([
    admin.from('companies').select('plan, email, affiliate_network_enabled').eq('id', user.company_id).single(),
    admin.from('company_addons').select('addon_key').eq('company_id', user.company_id).eq('enabled', true),
  ])
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const enabledAddonKeys = new Set((addonRows ?? []).map((r) => r.addon_key))
  const ctx = { plan: company.plan, enabledAddonKeys, affiliateNetworkEnabled: company.affiliate_network_enabled }

  const dict = getDict()
  const t = dict.admin.marketplace

  const TIER_NAME: Record<'basic' | 'plus', { assistant: string; growth: string }> = {
    basic: { assistant: dict.admin.assistant.basicTitle, growth: dict.admin.growthAssistant.basicTitle },
    plus: { assistant: dict.admin.assistant.plusTitle, growth: dict.admin.growthAssistant.plusTitle },
  }

  const cards: MarketplaceCardData[] = getMarketplaceItems().map((item) => {
    const copy = t.items[item.key]
    const quotaUnit = 'quotaUnit' in copy ? copy.quotaUnit : undefined
    return {
      key: item.key,
      route: item.route,
      isActive: item.isActive(ctx),
      includedInElitePlan: item.includedInElitePlan,
      hasFixedPrice: item.hasFixedPrice,
      name: copy.name,
      shortDesc: copy.shortDesc,
      features: copy.features,
      usage: copy.usage,
      quotaUnit,
      tiers: item.tiers
        ? item.tiers.map((tier) => ({
            addonKey: tier.addonKey,
            tierLabel: tier.tierLabel,
            tierName:
              tier.tierLabel === 'basic'
                ? (item.key === 'ai_chat' ? TIER_NAME.basic.assistant : TIER_NAME.basic.growth)
                : tier.tierLabel === 'plus'
                  ? (item.key === 'ai_chat' ? TIER_NAME.plus.assistant : TIER_NAME.plus.growth)
                  : undefined,
            price: tier.price,
            quota: tier.quota,
            checkoutUrl: tier.checkoutUrl,
          }))
        : null,
    }
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted max-w-2xl">{t.subtitle}</p>
      </div>

      <MarketplaceGrid cards={cards} t={t} companyEmail={company.email} />
    </div>
  )
}
