import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { InviteAffiliateForm } from '@/components/admin/affiliates/invite-affiliate-form'
import { AffiliateRelationRow, type AffiliateRelation } from '@/components/admin/affiliates/affiliate-relation-row'
import { AffiliateNetworkUpsell } from '@/components/admin/affiliates/affiliate-network-upsell'

export function generateMetadata(): Metadata {
  return { title: getDict().affiliates.pageTitle }
}

export default async function AffiliatesPage() {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const t = getDict().affiliates
  if (!user.company_id) return null
  const companyId = user.company_id

  const admin = createAdminClient()
  const [{ data: company }, { data: relations }] = await Promise.all([
    admin.from('companies').select('name, affiliate_network_enabled').eq('id', companyId).single(),
    admin
      .from('company_affiliates')
      .select('id, requester_company_id, affiliate_company_id, status, coverage_notes, payment_terms')
      .or(`requester_company_id.eq.${companyId},affiliate_company_id.eq.${companyId}`)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false }),
  ])

  const enabled = company?.affiliate_network_enabled ?? false

  const otherIds = Array.from(new Set((relations ?? []).map((r) =>
    r.requester_company_id === companyId ? r.affiliate_company_id : r.requester_company_id,
  )))
  const { data: otherCompanies } = otherIds.length
    ? await admin.from('companies').select('id, name').in('id', otherIds)
    : { data: [] as { id: string; name: string }[] }
  const nameById = new Map((otherCompanies ?? []).map((c) => [c.id, c.name]))

  const rows: AffiliateRelation[] = (relations ?? []).map((r) => {
    const otherId = r.requester_company_id === companyId ? r.affiliate_company_id : r.requester_company_id
    return {
      id: r.id,
      otherCompanyName: nameById.get(otherId) ?? '—',
      status: r.status,
      direction: r.requester_company_id === companyId ? 'outgoing' : 'incoming',
      coverageNotes: r.coverage_notes,
      paymentTerms: r.payment_terms,
    }
  })

  return (
    <div className="p-8 max-w-[900px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.pageTitle}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.pageSubtitle}</p>
      </div>

      {!enabled ? (
        <AffiliateNetworkUpsell companyName={company?.name ?? ''} t={t} />
      ) : (
        <>
          <InviteAffiliateForm t={t.relationships} />

          <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.relationships.listTitle}</p>
              <Link href="/admin/affiliates/requests" className="text-xs text-bronze hover:underline">{t.requests.title} →</Link>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-sl-on-surface-muted">{t.relationships.empty}</p>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <AffiliateRelationRow key={r.id} relation={r} t={t.relationships} chatT={t.chat} myCompanyId={companyId} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
