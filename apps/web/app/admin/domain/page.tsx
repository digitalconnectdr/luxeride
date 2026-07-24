import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import {
  CUSTOM_DOMAIN_MONTHLY_PRICE,
  CUSTOM_DOMAIN_BYOD_SETUP_FEE,
  getCustomDomainCheckoutUrl,
  getCustomDomainByodCheckoutUrl,
  isCustomDomainAddonActive,
  isCustomDomainByodActive,
} from '@/lib/billing/custom-domain-addon'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { CustomDomainManager } from '@/components/admin/domain/custom-domain-manager'
import { DomainRequestForm } from '@/components/admin/domain/domain-request-form'

export default async function CustomDomainPage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const [{ data: company }, { data: addonRows }] = await Promise.all([
    admin.from('companies').select('plan, email, custom_domain, custom_domain_status').eq('id', user.company_id).single(),
    admin.from('company_addons').select('addon_key').eq('company_id', user.company_id).eq('enabled', true),
  ])
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const t = getDict().admin.domain
  const enabledAddonKeys = new Set((addonRows ?? []).map((r) => r.addon_key))
  const byodActive = isCustomDomainByodActive(company.plan, enabledAddonKeys)
  const requestServiceActive = isCustomDomainAddonActive(enabledAddonKeys)
  const hasDomain = Boolean(company.custom_domain)

  const { data: latestRequest } = hasDomain
    ? { data: null }
    : await admin
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
        {/* Columna 1: conectar un dominio propio (BYOD) — cargo único, o ya conectado (por cualquiera de los 2 caminos). */}
        {hasDomain || byodActive ? (
          <CustomDomainManager
            currentDomain={company.custom_domain}
            currentStatus={company.custom_domain_status}
            t={t}
          />
        ) : (
          <AddonUpsellCard
            title={t.byodAddonTitle}
            body={t.byodAddonBody}
            price={CUSTOM_DOMAIN_BYOD_SETUP_FEE}
            checkoutUrl={getCustomDomainByodCheckoutUrl()}
            companyEmail={company.email}
            cadence="once"
          />
        )}

        {/* Columna 2: "consíganme uno" — cuota mensual, solo aplica si no hay dominio conectado todavía. */}
        {!hasDomain && (
          requestServiceActive ? (
            <DomainRequestForm latestRequest={latestRequest} t={t} />
          ) : (
            <AddonUpsellCard
              title={t.requestAddonTitle}
              body={t.requestAddonBody}
              price={CUSTOM_DOMAIN_MONTHLY_PRICE}
              checkoutUrl={getCustomDomainCheckoutUrl()}
              companyEmail={company.email}
            />
          )
        )}
      </div>
    </div>
  )
}
