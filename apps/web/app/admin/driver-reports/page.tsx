import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { DriverReportResolveButton } from '@/components/admin/driver-report-resolve-button'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

const CATEGORY_BADGE: Record<string, string> = {
  false_arrival: 'bg-amber-50 text-amber-700 border-amber-200',
  no_contact:    'bg-blue-50 text-blue-700 border-blue-200',
  unsafe:        'bg-red-50 text-red-700 border-red-200',
  other:         'bg-gray-50 text-gray-600 border-gray-200',
}

export function generateMetadata(): Metadata {
  return { title: getDict().admin.driverReportsList.title }
}

interface PageProps {
  searchParams: { status?: 'pending' | 'resolved' }
}

export default async function DriverReportsPage({ searchParams }: PageProps) {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const t = getDict().admin.driverReportsList
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  if (!user.company_id) {
    return (
      <div className="p-8">
        <p className="text-sm text-sl-on-surface-muted">{t.noCompany}</p>
      </div>
    )
  }

  const admin = createAdminClient()
  const filter = searchParams.status

  const { data: allReports } = await admin
    .from('trip_reports')
    .select('id, booking_id, driver_id, category, reason, resolved_at, created_at')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })
    .limit(300)

  const rows = allReports ?? []
  const pendingCount = rows.filter((r) => !r.resolved_at).length
  const resolvedCount = rows.filter((r) => !!r.resolved_at).length

  const filtered = filter === 'pending'
    ? rows.filter((r) => !r.resolved_at)
    : filter === 'resolved'
    ? rows.filter((r) => !!r.resolved_at)
    : rows

  const bookingIds = Array.from(new Set(filtered.map((r) => r.booking_id)))
  const { data: bookingsData } = bookingIds.length
    ? await admin.from('bookings').select('id, booking_number, passenger_name').in('id', bookingIds)
    : { data: [] as { id: string; booking_number: string; passenger_name: string | null }[] }
  const bookingById = new Map((bookingsData ?? []).map((b) => [b.id, b]))

  const driverIds = Array.from(new Set(filtered.map((r) => r.driver_id).filter((id): id is string => !!id)))
  const { data: driversData } = driverIds.length
    ? await admin.from('user_profiles').select('id, first_name, last_name').in('id', driverIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] }
  const driverById = new Map((driversData ?? []).map((d) => [d.id, `${d.first_name} ${d.last_name}`]))

  function tabHref(status?: 'pending' | 'resolved') {
    return status ? `/admin/driver-reports?status=${status}` : '/admin/driver-reports'
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">{t.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={tabHref(undefined)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !filter ? 'bg-[#1d1d1f] text-white' : 'bg-sl-surface-high border border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
          }`}
        >
          {t.all} ({rows.length})
        </Link>
        <Link
          href={tabHref('pending')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            filter === 'pending' ? 'bg-[#1d1d1f] text-white' : 'bg-sl-surface-high border border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
          }`}
        >
          {t.pending} ({pendingCount})
        </Link>
        <Link
          href={tabHref('resolved')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            filter === 'resolved' ? 'bg-[#1d1d1f] text-white' : 'bg-sl-surface-high border border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
          }`}
        >
          {t.resolved} ({resolvedCount})
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">
            {filter ? t.emptyFiltered.replace('{status}', filter === 'pending' ? t.pending.toLowerCase() : t.resolved.toLowerCase()) : t.empty}
          </p>
        </div>
      ) : (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thDate}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thBooking}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thDriver}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thCategory}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thReason}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thStatus}</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thActions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const booking = bookingById.get(r.booking_id)
                const driverName = r.driver_id ? driverById.get(r.driver_id) : null
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-sl-outline-variant last:border-0 hover:bg-sl-bg/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-sl-bg/20'}`}
                  >
                    <td className="px-5 py-3 text-sl-on-surface-muted whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString(localeTag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3">
                      {booking ? (
                        <Link href={`/admin/bookings/${r.booking_id}`} className="font-mono text-xs text-bronze hover:underline">
                          {booking.booking_number}
                        </Link>
                      ) : '—'}
                      {booking?.passenger_name && (
                        <p className="text-[11px] text-sl-on-surface-muted mt-0.5">{booking.passenger_name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sl-on-surface">
                      {driverName ?? t.unassignedDriver}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[r.category] ?? CATEGORY_BADGE.other}`}>
                        {t.categories[r.category as keyof typeof t.categories] ?? r.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sl-on-surface max-w-[260px]">
                      {r.reason}
                    </td>
                    <td className="px-5 py-3">
                      {r.resolved_at ? (
                        <span className="text-xs font-medium text-green-700">{t.statusResolved}</span>
                      ) : (
                        <span className="text-xs font-medium text-amber-600">{t.statusPending}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!r.resolved_at && (
                        <DriverReportResolveButton reportId={r.id} label={t.markResolved} resolving={t.resolving} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
