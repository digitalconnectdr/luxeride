import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { CUSTOM_DOMAIN_MONTHLY_PRICE, getCustomDomainCheckoutUrl, isCustomDomainAddonActive } from '@/lib/billing/custom-domain-addon'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { CustomDomainManager } from '@/components/admin/domain/custom-domain-manager'
import { DomainRequestForm } from '@/components/admin/domain/domain-request-form'

export default async function CustomDomainPage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const [{ data: company }, { data: addonRows }] = await Promise.all([
    admin.from('companies').select('email, custom_domain, custom_domain_status').eq('id', user.company_id).single(),
    admin.from('company_addons').select('addon_key').eq('company_id', user.company_id).eq('enabled', true),
  ])
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const t = getDict().admin.domain
  const enabledAddonKeys = new Set((addonRows ?? []).map((r) => r.addon_key))
  const active = isCustomDomainAddonActive(enabledAddonKeys)

  if (!active) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-6 rounded-full" />
        <AddonUpsellCard
          title={t.addonTitle}
          body={t.addonBody}
          price={CUSTOM_DOMAIN_MONTHLY_PRICE}
          checkoutUrl={getCustomDomainCheckoutUrl()}
          companyEmail={company.email}
        />
      </div>
    )
  }

  const { data: latestRequest } = await admin
    .from('domain_requests')
    .select('requested_name, status')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted max-w-2xl">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <CustomDomainManager
          currentDomain={company.custom_domain}
          currentStatus={company.custom_domain_status}
          t={t}
        />
        {!company.custom_domain && <DomainRequestForm latestRequest={latestRequest} t={t} />}
      </div>
    </div>
  )
}
