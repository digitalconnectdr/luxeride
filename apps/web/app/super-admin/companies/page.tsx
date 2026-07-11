import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { StatusSelect } from '@/components/super-admin/status-forms'
import type { CompanyStatus, CompanyPlan } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Companies | Super Admin' }

const STATUS_BADGE: Record<CompanyStatus, string> = {
  active:    'bg-green-500/10 text-green-400 border-green-500/20',
  trial:     'bg-gold/10 text-bronze border-bronze/20',
  suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40',
}

const PLAN_COLOR: Record<CompanyPlan, string> = {
  free:         'text-sl-on-surface-muted',
  starter:      'text-blue-400',
  professional: 'text-purple-400',
  elite:        'text-amber-400',
  enterprise:   'text-bronze',
}

const STATUS_TABS = [
  { label: 'All',       value: '' },
  { label: 'Active',    value: 'active' },
  { label: 'Trial',     value: 'trial' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Cancelled', value: 'cancelled' },
]

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const admin = createAdminClient()

  const { data: allData, error } = await admin
    .from('companies')
    .select('id, name, slug, status, plan, email, city, country, created_at')
    .order('created_at', { ascending: false })

  // Filter in JS — avoids Supabase builder type-gymnastics; N is small for admin
  const rawStatus = searchParams.status
  const statusFilter = typeof rawStatus === 'string' ? rawStatus : ''
  const rawQ = searchParams.q
  const q = (typeof rawQ === 'string' ? rawQ : '').trim().toLowerCase()

  const companies = (allData ?? []).filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false
    if (q && !c.name.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) {
      return false
    }
    return true
  })

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Companies</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          {companies.length} {statusFilter || 'total'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status tabs */}
        <div className="flex items-center gap-0.5 bg-sl-surface-high border border-sl-outline-variant rounded-xl p-1">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.value === statusFilter
            const params = new URLSearchParams()
            if (tab.value) params.set('status', tab.value)
            if (q) params.set('q', q)
            const href = `/super-admin/companies${params.toString() ? `?${params}` : ''}`
            return (
              <Link
                key={tab.label}
                href={href}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'bg-gold text-gray-900'
                    : 'text-sl-on-surface-muted hover:text-sl-on-surface',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* Search */}
        <form method="GET" className="flex-1 max-w-xs">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <input
            type="text"
            name="q"
            defaultValue={typeof rawQ === 'string' ? rawQ : undefined}
            placeholder="Search by name or slug…"
            className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-xl px-4 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-all"
          />
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          Error: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        {companies.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-sl-on-surface-muted">
            {q ? `No companies match "${q}"` : 'No companies.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                {['Company', 'Status', 'Plan', 'Location', 'Joined', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-sl-bg/40 transition-colors group">
                  <td className="px-5 py-4">
                    <p className="font-medium text-sl-on-surface">{c.name}</p>
                    <p className="text-xs text-sl-on-surface-muted mt-0.5">{c.slug}</p>
                    {c.email && (
                      <p className="text-xs text-sl-on-surface-muted">{c.email}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {/* Inline status change — Client Component */}
                    <StatusSelect companyId={c.id} current={c.status} />
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium capitalize ${PLAN_COLOR[c.plan]}`}>
                      {c.plan}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-sl-on-surface-muted">
                      {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-sl-on-surface-muted">
                      {new Date(c.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/super-admin/companies/${c.id}`}
                      className="text-xs font-medium text-bronze hover:text-bronze/80 hover:underline transition-colors"
                    >
                      Details →
                    </Link>
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
