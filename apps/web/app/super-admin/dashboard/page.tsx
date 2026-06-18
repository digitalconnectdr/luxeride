import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import type { CompanyStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Dashboard — Super Admin' }

const STATUS_BADGE: Record<CompanyStatus, string> = {
  active:    'bg-green-500/10 text-green-400 border-green-500/20',
  trial:     'bg-gold/10 text-bronze border-bronze/20',
  suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40',
}

function StatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[status]}`}
    >
      {status}
    </span>
  )
}

export default async function SuperAdminDashboardPage() {
  const admin = createAdminClient()

  const { data } = await admin
    .from('companies')
    .select('id, name, slug, status, plan, created_at, city, country')
    .order('created_at', { ascending: false })

  const all = data ?? []

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const stats = {
    total:       all.length,
    active:      all.filter((c) => c.status === 'active').length,
    trial:       all.filter((c) => c.status === 'trial').length,
    suspended:   all.filter((c) => c.status === 'suspended').length,
    newThisWeek: all.filter((c) => c.created_at > sevenDaysAgo).length,
  }

  const recent = all.slice(0, 8)

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
          Super Admin
        </h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">Platform overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',      value: stats.total,       color: 'text-sl-on-surface' },
          { label: 'Active',     value: stats.active,      color: 'text-green-400' },
          { label: 'Trial',      value: stats.trial,       color: 'text-bronze' },
          { label: 'New (7 d)',  value: stats.newThisWeek, color: 'text-blue-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              {s.label}
            </p>
            <p className={`text-4xl font-playfair font-semibold mt-2 ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Suspended alert */}
      {stats.suspended > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-red-400">
            <span className="font-semibold">{stats.suspended}</span>{' '}
            {stats.suspended === 1 ? 'company is' : 'companies are'} suspended
          </p>
          <Link
            href="/super-admin/companies?status=suspended"
            className="text-xs text-red-400 border border-red-500/30 rounded-lg px-3 py-1.5 hover:bg-red-500/10 transition-colors"
          >
            Review →
          </Link>
        </div>
      )}

      {/* Recent companies */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-sl-outline-variant flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sl-on-surface">Recent Companies</h2>
          <Link
            href="/super-admin/companies"
            className="text-xs text-bronze hover:text-bronze/80 transition-colors"
          >
            View all →
          </Link>
        </div>

        {all.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-sl-on-surface-muted">
            No companies yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                {['Company', 'Status', 'Plan', 'Location', 'Joined'].map((h) => (
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
              {recent.map((c) => (
                <tr key={c.id} className="hover:bg-sl-bg/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/super-admin/companies/${c.id}`}
                      className="font-medium text-sl-on-surface hover:text-bronze transition-colors"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-sl-on-surface-muted mt-0.5">{c.slug}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-sl-on-surface-muted capitalize">{c.plan}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-sl-on-surface-muted">
                      {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-sl-on-surface-muted">
                      {new Date(c.created_at).toLocaleDateString('en-US', {
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
