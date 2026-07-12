import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { PartnerForm } from '@/components/admin/partners/partner-form'
import { PartnerActiveToggle } from '@/components/admin/partners/partner-active-toggle'
import { CopyButton } from '@/components/trip/copy-button'

export default async function PartnersPage() {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('slug').eq('id', user.company_id).single()
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const { data: partners } = await admin
    .from('partners')
    .select('id, name, slug, rate_adjustment_pct, commission_type, commission_value, is_active')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })

  const t = getDict().admin.partners

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <PartnerForm t={t} />

      <div className="bg-sl-surface border border-sl-outline-variant rounded-xl overflow-hidden">
        {!partners?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted">{t.noPartners}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant text-left text-xs text-sl-on-surface-muted">
                <th className="px-4 py-3 font-medium">{t.name}</th>
                <th className="px-4 py-3 font-medium">{t.privateLink}</th>
                <th className="px-4 py-3 font-medium">{t.rateAdjustment}</th>
                <th className="px-4 py-3 font-medium">{t.commission}</th>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => {
                const url = `${getAppUrl()}/book/${company.slug}/partners/${p.slug}`
                return (
                  <tr key={p.id} className="border-b border-sl-outline-variant last:border-0">
                    <td className="px-4 py-3 text-sl-on-surface">
                      <Link href={`/admin/partners/${p.id}`} className="hover:text-bronze transition-colors">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-sl-on-surface-muted">
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="truncate font-mono text-xs">{url}</span>
                        <CopyButton text={url} label={t.copyLink} copiedLabel={t.copied} light />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sl-on-surface-muted">
                      {Number(p.rate_adjustment_pct) > 0 ? '+' : ''}{p.rate_adjustment_pct}%
                    </td>
                    <td className="px-4 py-3 text-sl-on-surface-muted">
                      {p.commission_type === 'percentage' ? `${p.commission_value}%` : `$${p.commission_value}`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PartnerActiveToggle
                        partnerId={p.id}
                        isActive={p.is_active}
                        activeLabel={t.active}
                        inactiveLabel={t.inactive}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/partners/${p.id}`} className="text-xs font-medium text-bronze hover:opacity-80">
                        {t.viewReport}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
