import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { updateCorporateAccountAction } from '@/app/actions/corporate'
import {
  CorporateAccountToggle,
  AddCorporateMemberForm,
  RemoveMemberButton,
} from '@/components/admin/corporate-controls'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import type { BookingStatus } from '@/lib/supabase/database.types'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.corporateDetail.title }
}

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'
const labelCls = 'block text-xs text-sl-on-surface-muted mb-1'

export default async function CorporateAccountDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await requireRole('company_owner', 'company_admin', 'accounting')
  if (!user.company_id) return notFound()

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('corporate_accounts')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', user.company_id)
    .single()

  if (!account) return notFound()

  const [{ data: members }, { data: bookings }] = await Promise.all([
    admin
      .from('corporate_members')
      .select('id, user_id, role, spending_limit, monthly_limit, cost_center, is_active, created_at')
      .eq('corporate_account_id', account.id)
      .order('created_at'),
    admin
      .from('bookings')
      .select('id, booking_number, status, passenger_name, scheduled_at, total_amount')
      .eq('corporate_account_id', account.id)
      .order('scheduled_at', { ascending: false })
      .limit(10),
  ])

  // Nombres de los miembros
  const memberIds = (members ?? []).map((m) => m.user_id)
  const profilesById = new Map<string, { first_name: string; last_name: string }>()
  if (memberIds.length > 0) {
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', memberIds)
    for (const p of profiles ?? []) profilesById.set(p.id, p)
  }

  const canManage = ['company_owner', 'company_admin'].includes(user.role)
  const updateAction: (fd: FormData) => void = updateCorporateAccountAction
  const dict = getDict().admin
  const t = dict.corporateDetail
  const f = dict.corporateForm
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/corporate" className="text-sm text-sl-on-surface-muted hover:text-bronze">
            {t.backToList}
          </Link>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mt-2">
            {account.name}
          </h1>
          <p className="text-xs text-sl-on-surface-muted mt-1">
            {t.createdOn.replace('{date}', new Date(account.created_at).toLocaleDateString(localeTag, { dateStyle: 'medium' }))}
          </p>
        </div>
        {canManage && (
          <CorporateAccountToggle accountId={account.id} isActive={account.is_active} labels={{ active: dict.corporateList.active, inactive: dict.corporateList.inactive }} />
        )}
      </div>

      {/* Balance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: t.pendingBalance, value: `$${Number(account.current_balance ?? 0).toFixed(2)}` },
          { label: t.creditLimit, value: `$${Number(account.credit_limit ?? 0).toFixed(0)}` },
          { label: t.paymentTerms, value: `Net ${account.payment_terms ?? 30}` },
        ].map((c) => (
          <div key={c.label} className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              {c.label}
            </p>
            <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Editar cuenta */}
      {canManage && (
        <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
          <h2 className="text-sm font-semibold text-sl-on-surface mb-5">{t.accountInfo}</h2>
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="account_id" value={account.id} />
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>{f.name} *</label>
                <input name="name" required defaultValue={account.name} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{f.contact}</label>
                <input name="contact_name" defaultValue={account.contact_name ?? ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{f.contactEmail}</label>
                <input name="contact_email" type="email" defaultValue={account.contact_email ?? ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{f.billingEmail}</label>
                <input name="billing_email" type="email" defaultValue={account.billing_email ?? ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{f.phone}</label>
                <input name="phone" type="tel" defaultValue={account.phone ?? ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{f.taxId}</label>
                <input name="tax_id" defaultValue={account.tax_id ?? ''} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{f.creditLimitUsd}</label>
                <input name="credit_limit" type="number" min="0" step="100" defaultValue={Number(account.credit_limit ?? 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{f.paymentTermsDays}</label>
                <input name="payment_terms" type="number" min="0" defaultValue={account.payment_terms ?? 30} className={inputCls} />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                name="require_approval"
                type="checkbox"
                value="true"
                defaultChecked={account.require_approval ?? false}
                className="w-4 h-4 rounded accent-bronze"
              />
              <span className="text-sm text-sl-on-surface">{f.requireApproval}</span>
            </label>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
                {f.saveChanges}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Miembros */}
      <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-sl-on-surface">
          {t.members.replace('{n}', String(members?.length ?? 0))}
        </h2>

        {!members?.length ? (
          <p className="text-sm text-sl-on-surface-muted">{t.noMembers}</p>
        ) : (
          <div className="divide-y divide-sl-outline-variant">
            {members.map((m) => {
              const profile = profilesById.get(m.user_id)
              return (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-sl-on-surface">
                        {profile ? `${profile.first_name} ${profile.last_name}` : m.user_id.slice(0, 8)}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        m.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {m.role === 'manager' ? dict.corporateMember.roleManager : dict.corporateMember.roleUser}
                      </span>
                    </div>
                    <p className="text-xs text-sl-on-surface-muted mt-0.5">
                      {m.cost_center && `${m.cost_center} · `}
                      {m.spending_limit != null && `${t.perTripLimit} $${Number(m.spending_limit).toFixed(0)} · `}
                      {m.monthly_limit != null && `${t.monthlyLabel} $${Number(m.monthly_limit).toFixed(0)}`}
                    </p>
                  </div>
                  {canManage && <RemoveMemberButton memberId={m.id} labels={{ removeConfirm: dict.corporateMember.removeConfirm, remove: dict.corporateMember.remove }} />}
                </div>
              )
            })}
          </div>
        )}

        {canManage && (
          <div className="pt-4 border-t border-sl-outline-variant">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
              {t.addMember}
            </p>
            <AddCorporateMemberForm accountId={account.id} labels={dict.corporateMember} />
          </div>
        )}
      </section>

      {/* Reservaciones recientes */}
      <section className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-sl-outline-variant">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            {t.accountBookings}
          </p>
        </div>
        {!bookings?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted text-center">
            {t.noBookings}
          </p>
        ) : (
          <div className="divide-y divide-sl-outline-variant">
            {bookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-sl-bg/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-bronze">{b.booking_number}</span>
                  <BookingStatusBadge status={b.status as BookingStatus} labels={dict.bookingStatuses} />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-sl-on-surface-muted">{b.passenger_name ?? '—'}</span>
                  <span className="font-semibold text-sl-on-surface">
                    {b.total_amount != null ? `$${Number(b.total_amount).toFixed(2)}` : '—'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
