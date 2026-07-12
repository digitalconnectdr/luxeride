import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import {
  AI_GROWTH_TIER_PRICE,
  AI_GROWTH_TIER_QUOTA,
  AI_GROWTH_OVERAGE_PRICE_PER_50,
  getAiGrowthCheckoutUrl,
  tierFromAiGrowthAddonKey,
} from '@/lib/billing/ai-growth-addon'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { ContentGenerator } from '@/components/admin/growth-assistant/content-generator'

function firstDayOfMonthIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export default async function GrowthAssistantPage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('email').eq('id', user.company_id).single()
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const t = getDict().admin.growthAssistant

  const { data: addons } = await admin
    .from('company_addons')
    .select('addon_key, enabled')
    .eq('company_id', user.company_id)
    .in('addon_key', ['ai_growth_basic', 'ai_growth_plus'])

  const activeAddonKey = (addons ?? []).find((a) => a.enabled)?.addon_key ?? null
  const tier = activeAddonKey ? tierFromAiGrowthAddonKey(activeAddonKey) : null

  if (!tier) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
          <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl">
          <AddonUpsellCard
            title={t.basicTitle}
            body={t.basicBody}
            price={AI_GROWTH_TIER_PRICE.basic}
            checkoutUrl={getAiGrowthCheckoutUrl('basic')}
            companyEmail={company.email}
          />
          <AddonUpsellCard
            title={t.plusTitle}
            body={t.plusBody}
            price={AI_GROWTH_TIER_PRICE.plus}
            checkoutUrl={getAiGrowthCheckoutUrl('plus')}
            companyEmail={company.email}
          />
        </div>
      </div>
    )
  }

  const { count: usedThisMonth } = await admin
    .from('ai_growth_generations')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', user.company_id)
    .gte('created_at', firstDayOfMonthIso())

  const used = usedThisMonth ?? 0
  const quota = AI_GROWTH_TIER_QUOTA[tier]
  const over = Math.max(0, used - quota)
  const pct = Math.min(100, Math.round((used / quota) * 100))

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-sl-on-surface-muted">{t.activeTier}</p>
          <span className="text-sm font-semibold text-sl-on-surface capitalize">
            {tier === 'basic' ? t.basicTitle : t.plusTitle} — ${AI_GROWTH_TIER_PRICE[tier]}/mes
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-sl-on-surface-muted">{t.usageTitle}</p>
            <p className="text-xs text-sl-on-surface">
              {t.generationsUsed.replace('{used}', String(used)).replace('{quota}', String(quota))}
            </p>
          </div>
          <div className="h-2 rounded-full bg-sl-outline-variant overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {over > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t.overageNote.replace('{over}', String(over)).replace('{price}', String(AI_GROWTH_OVERAGE_PRICE_PER_50))}
          </p>
        )}

        <p className="text-xs text-sl-on-surface-muted">{t.followupNote}</p>
      </div>

      <ContentGenerator t={t} />
    </div>
  )
}
