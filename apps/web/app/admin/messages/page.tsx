import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }
const PAGE_SIZE = 20

export function generateMetadata(): Metadata {
  return { title: getDict().admin.messagesList.title }
}

interface ThreadSummary {
  bookingId: string
  lastBody: string
  lastSender: 'client' | 'driver'
  lastAt: string
  count: number
}

interface PageProps {
  searchParams: { driver?: string; from?: string; to?: string; page?: string }
}

export default async function AdminMessagesPage({ searchParams }: PageProps) {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const t = getDict().admin.messagesList
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  if (!user.company_id) {
    return (
      <div className="p-8">
        <p className="text-sm text-sl-on-surface-muted">{t.noCompany}</p>
      </div>
    )
  }

  const admin = createAdminClient()

  // Ventana de los últimos mensajes de la empresa — suficiente para armar un
  // resumen por reserva (último mensaje + total) sin necesitar una vista SQL.
  const { data: recent } = await admin
    .from('trip_messages')
    .select('booking_id, sender, body, created_at')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })
    .limit(500)

  const threads = new Map<string, ThreadSummary>()
  for (const m of recent ?? []) {
    const existing = threads.get(m.booking_id)
    if (existing) {
      existing.count += 1
    } else {
      threads.set(m.booking_id, {
        bookingId: m.booking_id,
        lastBody: m.body,
        lastSender: m.sender as 'client' | 'driver',
        lastAt: m.created_at,
        count: 1,
      })
    }
  }

  const bookingIds = Array.from(threads.keys())
  const { data: bookings } = bookingIds.length
    ? await admin
        .from('bookings')
        .select('id, booking_number, passenger_name, status, driver_id')
        .eq('company_id', user.company_id)
        .in('id', bookingIds)
    : { data: [] as { id: string; booking_number: string; passenger_name: string | null; status: string; driver_id: string | null }[] }
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]))

  // Nombre del conductor de cada reserva — para poder buscar/filtrar por él.
  const driverIds = Array.from(new Set((bookings ?? []).map((b) => b.driver_id).filter((id): id is string => !!id)))
  const { data: driverProfiles } = driverIds.length
    ? await admin.from('user_profiles').select('id, first_name, last_name').in('id', driverIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] }
  const driverNameById = new Map((driverProfiles ?? []).map((d) => [d.id, `${d.first_name} ${d.last_name}`]))

  let rows = Array.from(threads.values())
    .filter((th) => bookingById.has(th.bookingId))
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

  const driverQuery = (searchParams.driver ?? '').trim().toLowerCase()
  const fromDate = searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : null
  const toDate = searchParams.to ? new Date(`${searchParams.to}T23:59:59`) : null

  if (driverQuery) {
    rows = rows.filter((th) => {
      const driverId = bookingById.get(th.bookingId)?.driver_id
      const name = driverId ? driverNameById.get(driverId) : null
      return (name ?? '').toLowerCase().includes(driverQuery)
    })
  }
  if (fromDate) rows = rows.filter((th) => new Date(th.lastAt) >= fromDate)
  if (toDate) rows = rows.filter((th) => new Date(th.lastAt) <= toDate)

  const hasFilters = !!(driverQuery || searchParams.from || searchParams.to)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1), totalPages)
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (searchParams.driver) params.set('driver', searchParams.driver)
    if (searchParams.from) params.set('from', searchParams.from)
    if (searchParams.to) params.set('to', searchParams.to)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/admin/messages?${qs}` : '/admin/messages'
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      {/* Filtros — GET form, sin JS, resetea a página 1 al enviar */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.driverLabel}</label>
          <input
            type="text"
            name="driver"
            defaultValue={searchParams.driver ?? ''}
            placeholder={t.searchDriverPlaceholder}
            className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.fromLabel}</label>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from ?? ''}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.toLabel}</label>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to ?? ''}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <button type="submit" className="px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-all">
          {t.filter}
        </button>
        {hasFilters && (
          <Link href="/admin/messages" className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface">
            {t.clearFilters}
          </Link>
        )}
      </form>

      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-sm text-sl-on-surface-muted text-center">{hasFilters ? t.noResults : t.empty}</p>
        ) : (
          <div className="divide-y divide-sl-outline-variant/50">
            {pagedRows.map((th) => {
              const b = bookingById.get(th.bookingId)!
              const driverName = b.driver_id ? driverNameById.get(b.driver_id) : null
              return (
                <Link
                  key={th.bookingId}
                  href={`/admin/messages/${th.bookingId}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-sl-bg/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-sl-on-surface truncate">
                        {b.passenger_name ?? t.unnamedPassenger}
                      </p>
                      <span className="text-[10px] font-mono text-sl-on-surface-muted">{b.booking_number}</span>
                      <span className="text-[10px] text-sl-on-surface-muted/70">
                        {driverName ?? t.unassignedDriver}
                      </span>
                    </div>
                    <p className="text-xs text-sl-on-surface-muted truncate mt-0.5">
                      <span className="font-medium">{th.lastSender === 'driver' ? t.driverLabel : t.clientLabel}:</span>{' '}
                      {th.lastBody}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-sl-on-surface-muted">
                      {new Date(th.lastAt).toLocaleString(localeTag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-sl-on-surface-muted/70 mt-0.5">{th.count} {t.messagesCount}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-sl-on-surface-muted">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-bronze hover:text-bronze/80">{t.prevPage}</Link>
          ) : <span />}
          <span>{t.pageInfo.replace('{page}', String(page)).replace('{total}', String(totalPages))}</span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="text-bronze hover:text-bronze/80">{t.nextPage}</Link>
          ) : <span />}
        </div>
      )}
    </div>
  )
}
