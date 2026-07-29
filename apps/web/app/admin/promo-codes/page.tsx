import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { isAddonActive, ADDON_MONTHLY_PRICE, getAddonCheckoutUrl } from '@/lib/billing/addons'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { PromoCodeForm } from '@/components/admin/promo-codes/promo-code-form'
import { PromoCodeActiveToggle } from '@/components/admin/promo-codes/promo-code-active-toggle'
import { RewardRulesPanel, type RewardRuleRow } from '@/components/admin/promo-codes/reward-rules-panel'
import { SectionTabs } from '@/components/admin/section-tabs'

export default async function PromoCodesPage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan, email, currency').eq('id', user.company_id).single()
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const { data: addon } = await admin
    .from('company_addons')
    .select('enabled')
    .eq('company_id', user.company_id)
    .eq('addon_key', 'promo_codes')
    .maybeSingle()

  const t = getDict().admin.promoCodes
  const active = isAddonActive(company.plan, addon?.enabled ?? false)

  if (!active) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-6 rounded-full" />
        <AddonUpsellCard
          title={t.addonTitle}
          body={t.addonBody}
          price={ADDON_MONTHLY_PRICE.promo_codes}
          checkoutUrl={getAddonCheckoutUrl('promo_codes')}
          companyEmail={company.email}
        />
      </div>
    )
  }

  const [{ data: codes }, { data: rules }] = await Promise.all([
    admin
      .from('promo_codes')
      .select('*')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false }),
    admin
      .from('reward_rules')
      .select('id, name, trigger_type, threshold, discount_type, discount_value, valid_days, is_active')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false }),
  ])

  const manualPanel = (
    <>
      <PromoCodeForm t={t} />

      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
        {!codes?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted">{t.noCodes}</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20 text-left text-[10px] uppercase tracking-widest text-sl-on-surface-muted">
                <th className="px-6 py-4 font-semibold">{t.code}</th>
                <th className="px-6 py-4 font-semibold">{t.discountType}</th>
                <th className="px-6 py-4 font-semibold">{t.uses}</th>
                <th className="px-6 py-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-sl-bg/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-sl-on-surface">{c.code}</td>
                  <td className="px-6 py-4 text-sl-on-surface">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}
                  </td>
                  <td className="px-6 py-4 text-sl-on-surface-muted">
                    {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <PromoCodeActiveToggle
                      promoCodeId={c.id}
                      isActive={c.is_active}
                      activeLabel={t.active}
                      inactiveLabel={t.inactive}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted max-w-[75ch]">{t.subtitle}</p>
      </div>

      <SectionTabs
        ariaLabel={t.title}
        tabs={[
          { key: 'manual', label: t.tabManual },
          { key: 'rules',  label: t.tabRules },
        ]}
        panels={{
          manual: manualPanel,
          rules: (
            <RewardRulesPanel
              rules={(rules ?? []) as RewardRuleRow[]}
              t={t}
              currency={company.currency ?? 'USD'}
            />
          ),
        }}
      />
    </div>
  )
}
