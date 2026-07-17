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
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <PartnerForm t={t} />

      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
        {!partners?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted">{t.noPartners}</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20 text-left text-[10px] uppercase tracking-widest text-sl-on-surface-muted">
                <th className="px-6 py-4 font-semibold">{t.name}</th>
                <th className="px-6 py-4 font-semibold">{t.privateLink}</th>
                <th className="px-6 py-4 font-semibold">{t.rateAdjustment}</th>
                <th className="px-6 py-4 font-semibold">{t.commission}</th>
                <th className="px-6 py-4 font-semibold"></th>
                <th className="px-6 py-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {partners.map((p) => {
                const url = `${getAppUrl()}/book/${company.slug}/partners/${p.slug}`
                return (
                  <tr key={p.id} className="hover:bg-sl-bg/40 transition-colors">
                    <td className="px-6 py-4 text-sl-on-surface">
                      <Link href={`/admin/partners/${p.id}`} className="hover:text-bronze transition-colors">{p.name}</Link>
                    </td>
                    <td className="px-6 py-4 text-sl-on-surface-muted">
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="truncate font-mono text-xs">{url}</span>
                        <CopyButton text={url} label={t.copyLink} copiedLabel={t.copied} light />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sl-on-surface-muted">
                      {Number(p.rate_adjustment_pct) > 0 ? '+' : ''}{p.rate_adjustment_pct}%
                    </td>
                    <td className="px-6 py-4 text-sl-on-surface-muted">
                      {p.commission_type === 'percentage' ? `${p.commission_value}%` : `$${p.commission_value}`}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <PartnerActiveToggle
                        partnerId={p.id}
                        isActive={p.is_active}
                        activeLabel={t.active}
                        inactiveLabel={t.inactive}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/partners/${p.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-bronze border border-bronze/30 rounded-lg hover:bg-bronze/5 hover:border-bronze transition-colors"
                      >
                        {t.viewReport}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
