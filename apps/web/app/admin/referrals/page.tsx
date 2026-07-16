import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { ReferralLinkCard } from '@/components/admin/referral-link-card'
import { REFERRAL_TIERS, getTierForCount, type ReferralTierKey } from '@/lib/referrals/tiers'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

export const metadata: Metadata = { title: 'Referidos' }

const TIER_LABEL_KEY: Record<ReferralTierKey, keyof Dictionary['admin']['referrals']> = {
  iniciado: 'tierIniciado',
  socio: 'tierSocio',
  aliado: 'tierAliado',
  embajador: 'tierEmbajador',
}

export default async function ReferralsPage() {
  const user = await requireRole('company_owner')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const dict = getDict(getLocale())
  const t = dict.admin.referrals

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('slug').eq('id', user.company_id).single()
  if (!company?.slug) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const { data: referrals } = await admin
    .from('company_referrals')
    .select('referred_company_id, tier_key, commission_pct, referred_at, expires_at')
    .eq('referrer_company_id', user.company_id)
    .order('referred_at', { ascending: false })

  const rows = referrals ?? []
  const referredIds = rows.map((r) => r.referred_company_id)
  const { data: referredCompanies } = referredIds.length
    ? await admin.from('companies').select('id, name').in('id', referredIds)
    : { data: [] as { id: string; name: string }[] }
  const nameById = new Map((referredCompanies ?? []).map((c) => [c.id, c.name]))

  const now = Date.now()
  const activeCount = rows.filter((r) => new Date(r.expires_at).getTime() > now).length
  const currentTier = getTierForCount(activeCount)
  const nextTier = REFERRAL_TIERS.find((tier) => tier.min > activeCount)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.pageTitle}</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1 max-w-2xl">{t.pageDesc}</p>
      </div>

      <ReferralLinkCard
        url={`${getAppUrl()}/r/${company.slug}`}
        title={t.linkTitle}
        desc={t.linkDesc}
        copyLabel={t.copyLink}
        copiedLabel={t.copiedLink}
      />

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
          {t.yourTierLabel}
        </p>
        {currentTier ? (
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-playfair text-2xl font-semibold text-bronze">
              {t[TIER_LABEL_KEY[currentTier.key]]}
            </span>
            <span className="text-sm text-sl-on-surface-muted">
              {activeCount} {t.countLabel} · {currentTier.pct}%
            </span>
            {nextTier && (
              <span className="text-xs text-sl-on-surface-muted">
                {nextTier.min - activeCount} → {t[TIER_LABEL_KEY[nextTier.key]]} ({nextTier.pct}%)
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-sl-on-surface-muted">{t.noTier}</p>
        )}
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        {!rows.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted text-center">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-outline-variant text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                  <th className="px-6 py-3 font-semibold">{t.tableReferred}</th>
                  <th className="px-6 py-3 font-semibold">{t.tableTier}</th>
                  <th className="px-6 py-3 font-semibold">{t.tableDate}</th>
                  <th className="px-6 py-3 font-semibold">{t.tableExpires}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant">
                {rows.map((r) => {
                  const expired = new Date(r.expires_at).getTime() <= now
                  return (
                    <tr key={r.referred_company_id}>
                      <td className="px-6 py-3.5 text-sl-on-surface whitespace-nowrap">
                        {nameById.get(r.referred_company_id) ?? '—'}
                      </td>
                      <td className="px-6 py-3.5 text-sl-on-surface-muted whitespace-nowrap">
                        {t[TIER_LABEL_KEY[r.tier_key as ReferralTierKey]]} · {Number(r.commission_pct)}%
                      </td>
                      <td className="px-6 py-3.5 text-sl-on-surface-muted whitespace-nowrap">
                        {new Date(r.referred_at).toLocaleDateString('es-DO', { dateStyle: 'medium' })}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {expired ? (
                          <span className="text-sl-on-surface-muted">{t.tableExpired}</span>
                        ) : (
                          <span className="text-sl-on-surface-muted">
                            {new Date(r.expires_at).toLocaleDateString('es-DO', { dateStyle: 'medium' })}
                          </span>
                        )}
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
