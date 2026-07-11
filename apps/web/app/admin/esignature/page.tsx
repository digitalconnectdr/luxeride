import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { isAddonActive, ADDON_MONTHLY_PRICE, getAddonCheckoutUrl } from '@/lib/billing/addons'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { AgreementList } from '@/components/admin/esignature/agreement-list'
import { DRIVER_AGREEMENT_TEXT, CORPORATE_AGREEMENT_TEXT } from '@/lib/esignature/templates'

export default async function ESignaturePage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan, email').eq('id', user.company_id).single()
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const { data: addon } = await admin
    .from('company_addons')
    .select('enabled')
    .eq('company_id', user.company_id)
    .eq('addon_key', 'esignature')
    .maybeSingle()

  const t = getDict().admin.esignature
  const active = isAddonActive(company.plan, addon?.enabled ?? false)

  if (!active) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface mb-6">{t.title}</h1>
        <AddonUpsellCard
          title={t.addonTitle}
          body={t.addonBody}
          price={ADDON_MONTHLY_PRICE.esignature}
          checkoutUrl={getAddonCheckoutUrl('esignature')}
          companyEmail={company.email}
        />
      </div>
    )
  }

  const [{ data: profiles }, { data: corporateAccounts }, { data: signedAgreements }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', user.company_id)
      .eq('role', 'driver')
      .order('first_name', { ascending: true }),
    admin
      .from('corporate_accounts')
      .select('id, name')
      .eq('company_id', user.company_id)
      .order('name', { ascending: true }),
    admin
      .from('signed_agreements')
      .select('subject_type, subject_id, signed_at')
      .eq('company_id', user.company_id),
  ])

  const signedAtBySubject = new Map(
    (signedAgreements ?? []).map((a) => [`${a.subject_type}:${a.subject_id}`, a.signed_at]),
  )

  const driverSubjects = (profiles ?? []).map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    signedAt: signedAtBySubject.get(`driver:${p.id}`) ?? null,
  }))

  const corporateSubjects = (corporateAccounts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    signedAt: signedAtBySubject.get(`corporate_account:${c.id}`) ?? null,
  }))

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-sl-on-surface mb-3">{t.drivers}</h2>
        <AgreementList
          subjectType="driver"
          title={t.driverAgreementTitle}
          agreementText={DRIVER_AGREEMENT_TEXT}
          subjects={driverSubjects}
          noneLabel={t.noDrivers}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-sl-on-surface mb-3">{t.corporateAccounts}</h2>
        <AgreementList
          subjectType="corporate_account"
          title={t.corporateAgreementTitle}
          agreementText={CORPORATE_AGREEMENT_TEXT}
          subjects={corporateSubjects}
          noneLabel={t.noCorporateAccounts}
        />
      </div>
    </div>
  )
}
