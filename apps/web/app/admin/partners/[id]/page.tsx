import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { computePartnerCommission, type PartnerCommissionType } from '@/lib/partners/engine'
import { PartnerForm, type ExistingPartner } from '@/components/admin/partners/partner-form'
import { MarkPartnerPaidButton } from '@/components/admin/partners/mark-partner-paid-button'
import { CopyButton } from '@/components/trip/copy-button'
import { addIsoDays, getZonedIsoDate, isoDateStartOfMonth, zonedMidnightUtc } from '@/lib/time/zoned-bounds'

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { from?: string; to?: string }
}) {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const [{ data: company }, { data: partner }] = await Promise.all([
    admin.from('companies').select('slug, timezone').eq('id', user.company_id).single(),
    admin.from('partners').select('*').eq('id', params.id).eq('company_id', user.company_id).single(),
  ])
  if (!company || !partner) return notFound()

  const t = getDict().admin.partners
  // Límites en la zona horaria de la EMPRESA, no en UTC del servidor (mismo
  // criterio que /admin/reports y /admin/payroll).
  const todayIso = getZonedIsoDate(new Date(), company.timezone)
  const periodStart = searchParams.from || isoDateStartOfMonth(todayIso)
  const periodEnd = searchParams.to || todayIso

  const [{ data: trips }, { data: alreadyPaid }] = await Promise.all([
    admin
      .from('bookings')
      .select('total_amount')
      .eq('company_id', user.company_id)
      .eq('partner_id', partner.id)
      .eq('status', 'completed')
      .gte('completed_at', zonedMidnightUtc(periodStart, company.timezone).toISOString())
      .lt('completed_at', zonedMidnightUtc(addIsoDays(periodEnd, 1), company.timezone).toISOString()),
    admin
      .from('partner_payments')
      .select('id')
      .eq('partner_id', partner.id)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .maybeSingle(),
  ])

  const tripRows = trips ?? []
  const commissionType = partner.commission_type as PartnerCommissionType
  const totalCommission = tripRows.reduce(
    (sum, b) => sum + computePartnerCommission({ commissionType, commissionValue: Number(partner.commission_value) }, Number(b.total_amount ?? 0)),
    0,
  )
  const isPaid = Boolean(alreadyPaid)
  const portalUrl = `${getAppUrl()}/book/${company.slug}/partners/${partner.slug}`

  const existingPartner: ExistingPartner = {
    id: partner.id,
    name: partner.name,
    slug: partner.slug,
    logoUrl: partner.logo_url,
    contactName: partner.contact_name,
    contactEmail: partner.contact_email,
    contactPhone: partner.contact_phone,
    rateAdjustmentPct: Number(partner.rate_adjustment_pct),
    commissionType,
    commissionValue: Number(partner.commission_value),
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <Link href="/admin/partners" className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface transition-colors">← {t.title}</Link>
        <h1 className="text-3xl font-playfair font-semibold text-sl-on-surface mt-2">{partner.name}</h1>
        <div className="w-8 h-[3px] bg-gold mt-2 mb-2 rounded-full" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-sl-on-surface-muted truncate max-w-md">{portalUrl}</span>
          <CopyButton text={portalUrl} label={t.copyLink} copiedLabel={t.copied} light />
        </div>
      </div>

      <PartnerForm t={t} partner={existingPartner} />

      <div>
        <h2 className="text-sm font-semibold text-sl-on-surface mb-3">{t.commissionReport}</h2>
        <form className="flex items-end gap-3 bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-4 mb-4">
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.from}</label>
            <input type="date" name="from" defaultValue={periodStart} className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5" />
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.to}</label>
            <input type="date" name="to" defaultValue={periodEnd} className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5" />
          </div>
          <button type="submit" className="text-sm font-medium px-4 py-1.5 bg-bronze text-white rounded-lg hover:opacity-90 transition-opacity">
            {t.period}
          </button>
        </form>

        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.tripsInPeriod}</p>
            <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-1">{tripRows.length}</p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.commissionOwed}</p>
            <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-1">${totalCommission.toFixed(2)}</p>
          </div>
          <div>
            {isPaid ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">{t.periodPaid}</span>
            ) : (
              <MarkPartnerPaidButton partnerId={partner.id} periodStart={periodStart} periodEnd={periodEnd} label={t.markPaid} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
