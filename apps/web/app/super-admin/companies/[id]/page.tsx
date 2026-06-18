import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { StatusSelect, PlanSelect } from '@/components/super-admin/status-forms'
import type { CompanyStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Company Detail — Super Admin' }

const STATUS_BADGE: Record<CompanyStatus, string> = {
  active:    'bg-green-500/10 text-green-400 border-green-500/20',
  trial:     'bg-gold/10 text-bronze border-bronze/20',
  suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40',
}

const ROLE_COLOR: Record<string, string> = {
  company_owner:    'text-bronze',
  company_admin:    'text-purple-400',
  dispatcher:       'text-blue-400',
  accounting:       'text-green-400',
  driver:           'text-sl-on-surface',
  customer:         'text-sl-on-surface-muted',
  corporate_manager:'text-orange-400',
  corporate_user:   'text-sl-on-surface-muted',
}

interface PageProps {
  params: { id: string }
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const admin = createAdminClient()

  const [{ data: company, error: companyError }, { data: users }] = await Promise.all([
    admin.from('companies').select('*').eq('id', params.id).single(),
    admin
      .from('user_profiles')
      .select('id, role, first_name, last_name, phone, is_active, created_at')
      .eq('company_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  if (companyError || !company) return notFound()

  const allUsers = users ?? []
  const activeCount = allUsers.filter((u) => u.is_active).length

  // Info rows helper
  const info = [
    { label: 'Phone',         value: company.phone },
    { label: 'Email',         value: company.email },
    { label: 'Address',       value: company.address },
    { label: 'City',          value: company.city },
    { label: 'Country',       value: company.country },
    { label: 'Timezone',      value: company.timezone },
    { label: 'Currency',      value: company.currency },
    { label: 'Distance unit', value: company.distance_unit },
    {
      label: 'Created',
      value: new Date(company.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    },
  ]

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-sl-on-surface-muted">
        <Link href="/super-admin/companies" className="hover:text-bronze transition-colors">
          Companies
        </Link>
        <span>/</span>
        <span className="text-sl-on-surface">{company.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
            {company.name}
          </h1>
          <p className="text-sm text-sl-on-surface-muted mt-1">
            <span className="text-bronze font-medium">{company.slug}</span>
            <span className="mx-2 text-sl-outline-variant">·</span>
            <code className="text-xs">{company.id}</code>
          </p>
        </div>
        <span
          className={`inline-flex items-center shrink-0 px-3 py-1 rounded-full text-sm font-medium border ${STATUS_BADGE[company.status]}`}
        >
          {company.status}
        </span>
      </div>

      {/* Status + Plan management */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Account Status
          </h2>
          <StatusSelect companyId={company.id} current={company.status} />
          {company.trial_ends_at && company.status === 'trial' && (
            <p className="text-xs text-sl-on-surface-muted">
              Trial ends:{' '}
              {new Date(company.trial_ends_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 space-y-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Subscription Plan
          </h2>
          <PlanSelect companyId={company.id} current={company.plan} />
        </div>
      </div>

      {/* Company info */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-5">
          Company Info
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          {info.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-sl-on-surface-muted">{label}</dt>
              <dd className="text-sm text-sl-on-surface mt-0.5">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Stripe */}
      {(company.stripe_customer_id || company.stripe_subscription_id) && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 space-y-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Stripe
          </h2>
          {company.stripe_customer_id && (
            <div>
              <dt className="text-xs text-sl-on-surface-muted">Customer ID</dt>
              <dd className="text-sm font-mono text-sl-on-surface mt-0.5">
                {company.stripe_customer_id}
              </dd>
            </div>
          )}
          {company.stripe_subscription_id && (
            <div>
              <dt className="text-xs text-sl-on-surface-muted">Subscription ID</dt>
              <dd className="text-sm font-mono text-sl-on-surface mt-0.5">
                {company.stripe_subscription_id}
              </dd>
            </div>
          )}
        </div>
      )}

      {/* Users */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-sl-outline-variant flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sl-on-surface">
            Users ({allUsers.length})
          </h2>
          <span className="text-xs text-sl-on-surface-muted">{activeCount} active</span>
        </div>

        {allUsers.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-sl-on-surface-muted">
            No users in this company yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                {['Name', 'Role', 'Phone', 'Status', 'Joined'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-sl-bg/40 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-sl-on-surface">
                      {u.first_name} {u.last_name}
                    </p>
                    <p className="text-[11px] text-sl-on-surface-muted font-mono mt-0.5">
                      {u.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium ${ROLE_COLOR[u.role] ?? 'text-sl-on-surface-muted'}`}
                    >
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-sl-on-surface-muted">{u.phone ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        u.is_active
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-sl-on-surface-muted">
                      {new Date(u.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
