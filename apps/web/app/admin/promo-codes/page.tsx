import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { isAddonActive, ADDON_MONTHLY_PRICE, getAddonCheckoutUrl } from '@/lib/billing/addons'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { PromoCodeForm } from '@/components/admin/promo-codes/promo-code-form'
import { PromoCodeActiveToggle } from '@/components/admin/promo-codes/promo-code-active-toggle'

export default async function PromoCodesPage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan, email').eq('id', user.company_id).single()
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
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface mb-6">{t.title}</h1>
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

  const { data: codes } = await admin
    .from('promo_codes')
    .select('*')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <PromoCodeForm t={t} />

      <div className="bg-sl-surface border border-sl-outline-variant rounded-xl overflow-hidden">
        {!codes?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted">{t.noCodes}</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant text-left text-xs text-sl-on-surface-muted">
                <th className="px-4 py-3 font-medium">{t.code}</th>
                <th className="px-4 py-3 font-medium">{t.discountType}</th>
                <th className="px-4 py-3 font-medium">{t.uses}</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-sl-outline-variant last:border-0">
                  <td className="px-4 py-3 font-mono text-sl-on-surface">{c.code}</td>
                  <td className="px-4 py-3 text-sl-on-surface">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}
                  </td>
                  <td className="px-4 py-3 text-sl-on-surface-muted">
                    {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right">
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
    </div>
  )
}
