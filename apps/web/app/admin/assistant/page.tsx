import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import {
  AI_CHAT_TIER_PRICE,
  AI_CHAT_TIER_QUOTA,
  AI_CHAT_OVERAGE_PRICE_PER_100,
  getAiChatCheckoutUrl,
  tierFromAddonKey,
} from '@/lib/billing/ai-chat-addon'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { getZonedIsoDate, isoDateStartOfMonth, zonedMidnightUtc } from '@/lib/time/zoned-bounds'

export default async function AssistantPage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('email, timezone').eq('id', user.company_id).single()
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const t = getDict().admin.assistant

  const { data: addons } = await admin
    .from('company_addons')
    .select('addon_key, enabled')
    .eq('company_id', user.company_id)
    .in('addon_key', ['ai_chat_basic', 'ai_chat_plus'])

  const activeAddonKey = (addons ?? []).find((a) => a.enabled)?.addon_key ?? null
  const tier = activeAddonKey ? tierFromAddonKey(activeAddonKey) : null

  if (!tier) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto space-y-5">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">{t.subtitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl">
          <AddonUpsellCard
            title={t.basicTitle}
            body={t.basicBody}
            price={AI_CHAT_TIER_PRICE.basic}
            checkoutUrl={getAiChatCheckoutUrl('basic')}
            companyEmail={company.email}
          />
          <AddonUpsellCard
            title={t.plusTitle}
            body={t.plusBody}
            price={AI_CHAT_TIER_PRICE.plus}
            checkoutUrl={getAiChatCheckoutUrl('plus')}
            companyEmail={company.email}
          />
        </div>
      </div>
    )
  }

  // Límite en la zona horaria de la EMPRESA, no en UTC del servidor (mismo
  // criterio que /admin/reports) — si no, el reseteo mensual de cuota queda
  // desalineado con el "1ro del mes" real del operador.
  const monthStartIso = isoDateStartOfMonth(getZonedIsoDate(new Date(), company.timezone))
  const { count: usedThisMonth } = await admin
    .from('ai_chat_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', user.company_id)
    .gte('started_at', zonedMidnightUtc(monthStartIso, company.timezone).toISOString())

  const used = usedThisMonth ?? 0
  const quota = AI_CHAT_TIER_QUOTA[tier]
  const over = Math.max(0, used - quota)
  const pct = Math.min(100, Math.round((used / quota) * 100))

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-sl-on-surface-muted">{t.activeTier}</p>
          <span className="text-sm font-semibold text-sl-on-surface capitalize">
            {tier === 'basic' ? t.basicTitle : t.plusTitle} — ${AI_CHAT_TIER_PRICE[tier]}/mes
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-sl-on-surface-muted">{t.usageTitle}</p>
            <p className="text-xs text-sl-on-surface">
              {t.conversationsUsed.replace('{used}', String(used)).replace('{quota}', String(quota))}
            </p>
          </div>
          <div className="h-2 rounded-full bg-sl-outline-variant overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {over > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t.overageNote.replace('{over}', String(over)).replace('{price}', String(AI_CHAT_OVERAGE_PRICE_PER_100))}
          </p>
        )}

        <p className="text-xs text-sl-on-surface-muted">{t.liveNote}</p>
        <p className="text-[11px] text-sl-on-surface-muted/70">{t.poweredBy}</p>
      </div>
    </div>
  )
}
