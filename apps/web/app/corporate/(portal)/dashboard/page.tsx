import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import { TeamLimitsForm } from '@/components/corporate/team-limits-form'
import { InviteMemberByLinkForm } from '@/components/corporate/invite-member-form'
import { computeAccountSla } from '@/lib/corporate/sla'
import { getLocale, getDict } from '@/lib/i18n/server'
import type { BookingStatus } from '@/lib/supabase/database.types'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().corporate.dashboard.defaultAccountName }
}

export default async function CorporateDashboardPage() {
  const user = await requireRole('corporate_manager', 'corporate_user')
  const locale = getLocale()
  const localeTag = LOCALE_TAGS[locale] ?? 'en-US'
  const t = getDict(locale).corporate.dashboard

  const admin = createAdminClient()

  // Membresía corporativa del usuario
  const { data: membership } = await admin
    .from('corporate_members')
    .select('id, corporate_account_id, role, spending_limit, monthly_limit, cost_center')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!membership) {
    return (
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-10 text-center">
        <p className="text-sm text-sl-on-surface-muted">{t.noMembership}</p>
      </div>
    )
  }

  const { data: account } = await admin
    .from('corporate_accounts')
    .select('id, name, credit_limit, current_balance, require_approval')
    .eq('id', membership.corporate_account_id)
    .single()

  const isManager = membership.role === 'manager'

  // Bookings: manager ve toda la cuenta; usuario solo los suyos
  let bookingsQuery = admin
    .from('bookings')
    .select('id, booking_number, status, passenger_name, scheduled_at, total_amount, customer_id')
    .eq('corporate_account_id', membership.corporate_account_id)
    .order('scheduled_at', { ascending: false })
    .limit(15)

  if (!isManager) {
    bookingsQuery = bookingsQuery.eq('customer_id', user.id)
  }

  // SLA de la cuenta: siempre la cuenta completa (nivel de servicio, no
  // información financiera) — se calcula por separado sin el límite de 15
  // filas de la lista de arriba, para que el % refleje el historial real.
  const slaQuery = admin
    .from('bookings')
    .select('status, scheduled_at, arrived_at')
    .eq('corporate_account_id', membership.corporate_account_id)
    .in('status', ['completed', 'cancelled', 'no_show'])

  const [{ data: bookings }, { data: slaBookings }] = await Promise.all([bookingsQuery, slaQuery])
  const sla = computeAccountSla(slaBookings ?? [])

  // Facturas + equipo — solo el manager los ve/gestiona
  let invoices: { id: string; invoice_number: string; status: string; subtotal: number; total_amount: number; currency: string | null; due_date: string | null; created_at: string }[] = []
  let invoiceLineItemsByInvoice = new Map<string, { description: string; total_price: number }[]>()
  let teamMembers: { id: string; name: string; role: 'manager' | 'user'; spendingLimit: number | null; monthlyLimit: number | null; isSelf: boolean }[] = []
  let assignedTotal = 0

  if (isManager) {
    const [{ data: invoiceRows }, { data: memberRows }] = await Promise.all([
      admin
        .from('invoices')
        .select('id, invoice_number, status, subtotal, total_amount, currency, due_date, created_at')
        .eq('corporate_account_id', membership.corporate_account_id)
        .order('created_at', { ascending: false })
        .limit(24),
      admin
        .from('corporate_members')
        .select('id, user_id, role, spending_limit, monthly_limit')
        .eq('corporate_account_id', membership.corporate_account_id)
        .eq('is_active', true)
        .order('role'),
    ])

    invoices = invoiceRows ?? []
    if (invoices.length > 0) {
      const { data: lineItems } = await admin
        .from('invoice_line_items')
        .select('invoice_id, description, total_price')
        .in('invoice_id', invoices.map((i) => i.id))
      for (const item of lineItems ?? []) {
        const list = invoiceLineItemsByInvoice.get(item.invoice_id) ?? []
        list.push({ description: item.description, total_price: Number(item.total_price) })
        invoiceLineItemsByInvoice.set(item.invoice_id, list)
      }
    }

    const memberUserIds = (memberRows ?? []).map((m) => m.user_id)
    const { data: memberProfiles } = memberUserIds.length
      ? await admin.from('user_profiles').select('id, first_name, last_name').in('id', memberUserIds)
      : { data: [] as { id: string; first_name: string; last_name: string }[] }
    const nameByUserId = new Map((memberProfiles ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]))

    teamMembers = (memberRows ?? []).map((m) => ({
      id: m.id,
      name: nameByUserId.get(m.user_id) ?? '—',
      role: m.role as 'manager' | 'user',
      spendingLimit: m.spending_limit != null ? Number(m.spending_limit) : null,
      monthlyLimit: m.monthly_limit != null ? Number(m.monthly_limit) : null,
      isSelf: m.user_id === user.id,
    }))
    assignedTotal = teamMembers.reduce((sum, m) => sum + (m.monthlyLimit ?? 0), 0)
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const monthSpend = (bookings ?? [])
    .filter((b) => b.status === 'completed' && new Date(b.scheduled_at) >= monthStart)
    .reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)

  const invoiceStatusLabel: Record<string, string> = t.invoices.status
  const invoiceStatusCls: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-600', cancelled: 'bg-gray-100 text-gray-500',
  }

  const today = new Date()
  const monthStartStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
          {account?.name ?? t.defaultAccountName}
        </h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          {t.greeting.replace('{name}', user.profile.first_name)} |{' '}
          <span className="text-bronze">{isManager ? t.roleManager : t.roleUser}</span>
          {membership.cost_center && ` · ${membership.cost_center}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            {t.kpi.monthSpend}
          </p>
          <p className="text-3xl font-playfair font-semibold text-sl-on-surface mt-2">
            ${monthSpend.toFixed(2)}
          </p>
        </div>
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            {t.kpi.perTripLimit}
          </p>
          <p className="text-3xl font-playfair font-semibold text-sl-on-surface mt-2">
            {membership.spending_limit != null ? `$${Number(membership.spending_limit).toFixed(0)}` : t.kpi.noLimit}
          </p>
        </div>
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            {t.kpi.monthlyLimit}
          </p>
          <p className="text-3xl font-playfair font-semibold text-sl-on-surface mt-2">
            {membership.monthly_limit != null ? `$${Number(membership.monthly_limit).toFixed(0)}` : t.kpi.noLimit}
          </p>
        </div>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
          {t.sla.title}
        </p>
        {sla.completedCount === 0 ? (
          <p className="text-sm text-sl-on-surface-muted">{t.sla.noData}</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-2xl font-playfair font-semibold text-sl-on-surface">
                {sla.punctualityPct ?? '—'}%
              </p>
              <p className="text-xs text-sl-on-surface-muted mt-0.5">{t.sla.punctuality}</p>
            </div>
            <div>
              <p className="text-2xl font-playfair font-semibold text-sl-on-surface">
                {sla.cancellationPct ?? 0}%
              </p>
              <p className="text-xs text-sl-on-surface-muted mt-0.5">{t.sla.cancellation}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Link
          href="/corporate/book"
          className="px-5 py-2.5 text-sm font-medium bg-gold text-gray-900 rounded-xl hover:bg-gold/90 transition-colors"
        >
          {t.newBooking}
        </Link>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-sl-outline-variant">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            {isManager ? t.trips.accountTitle : t.trips.mineTitle}
          </p>
        </div>
        {!bookings?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted text-center">{t.trips.empty}</p>
        ) : (
          <div className="divide-y divide-sl-outline-variant">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-bronze">{b.booking_number}</span>
                  <BookingStatusBadge status={b.status as BookingStatus} />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-sl-on-surface-muted">
                    {new Date(b.scheduled_at).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  <span className="font-semibold text-sl-on-surface">
                    {b.total_amount != null ? `$${Number(b.total_amount).toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isManager && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-sl-outline-variant">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.invoices.title}</p>
          </div>
          {!invoices.length ? (
            <p className="p-6 text-sm text-sl-on-surface-muted text-center">{t.invoices.empty}</p>
          ) : (
            <div className="divide-y divide-sl-outline-variant">
              {invoices.map((inv) => (
                <details key={inv.id} className="group px-6 py-3.5">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-bronze">{inv.invoice_number}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${invoiceStatusCls[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {invoiceStatusLabel[inv.status] ?? inv.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-sl-on-surface-muted">
                        {inv.due_date ? t.invoices.due.replace('{date}', new Date(inv.due_date).toLocaleDateString(localeTag, { dateStyle: 'medium' })) : '—'}
                      </span>
                      <span className="font-semibold text-sl-on-surface">
                        ${Number(inv.total_amount).toFixed(2)} {inv.currency ?? 'USD'}
                      </span>
                      <span className="text-sl-on-surface-muted transition-transform group-open:rotate-90">›</span>
                    </div>
                  </summary>
                  <div className="mt-3 pl-1 space-y-1.5">
                    {(invoiceLineItemsByInvoice.get(inv.id) ?? []).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-sl-on-surface-muted">{item.description}</span>
                        <span className="text-sl-on-surface">${item.total_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {isManager && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.report.title}</p>
          <form action="/api/reports/bookings" method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="corporate_account_id" value={membership.corporate_account_id} />
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.report.from}</label>
              <input type="date" name="from" defaultValue={monthStartStr} className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze" />
            </div>
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.report.to}</label>
              <input type="date" name="to" defaultValue={todayStr} className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze" />
            </div>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
              {t.report.download}
            </button>
          </form>
        </div>
      )}

      {isManager && teamMembers.length > 0 && (
        <TeamLimitsForm
          members={teamMembers}
          creditLimit={Number(account?.credit_limit ?? 0)}
          assignedTotal={assignedTotal}
          t={t.team}
        />
      )}

      {isManager && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-4">{t.invite.title}</p>
          <InviteMemberByLinkForm
            accountId={membership.corporate_account_id}
            labels={{
              emailLabel: t.invite.emailLabel,
              roleLabel: t.invite.roleLabel,
              roleUser: t.invite.roleUser,
              roleManager: t.invite.roleManager,
              costCenterLabel: t.invite.costCenterLabel,
              spendingLimitLabel: t.invite.spendingLimitLabel,
              monthlyLimitLabel: t.invite.monthlyLimitLabel,
              submit: t.invite.submit,
              submitting: t.invite.submitting,
              linkGeneratedTitle: t.invite.linkGeneratedTitle,
              linkHint: t.invite.linkHint,
              copy: t.invite.copy,
              copied: t.invite.copied,
              error: t.invite.error,
            }}
          />
        </div>
      )}
    </div>
  )
}
