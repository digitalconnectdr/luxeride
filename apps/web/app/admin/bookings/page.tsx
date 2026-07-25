import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import type { BookingStatus } from '@/lib/supabase/database.types'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.bookingsList.title }
}

const ALL_STATUSES: BookingStatus[] = [
  'pending', 'assigned', 'en_route', 'arrived', 'in_progress',
  'completed', 'cancelled', 'no_show',
]

const BOOKINGS_PAGE_SIZE = 20

// Columnas realmente ordenables — pickup/dropoff (JSON) y pago (calculado
// desde otra tabla) quedan fuera porque no hay una columna simple a la que
// mapear un ORDER BY.
const SORT_COLUMNS: Record<string, string> = {
  number: 'booking_number',
  passenger: 'passenger_name',
  status: 'status',
  datetime: 'scheduled_at',
  total: 'total_amount',
  rating: 'rating',
}
const DEFAULT_SORT = 'datetime'

interface LocationJson {
  address?: string
  lat?: number
  lng?: number
}

function shortAddress(loc: unknown): string {
  if (!loc || typeof loc !== 'object') return '—'
  const l = loc as LocationJson
  if (!l.address) return '—'
  // Tomar solo la primera parte (antes de la primera coma)
  return l.address.split(',')[0] ?? l.address
}

function formatDate(iso: string, tag: string): string {
  return new Date(iso).toLocaleString(tag, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// El filtro .or() de PostgREST usa "," y "(" ")" como sintaxis — envolver el
// valor entre comillas dobles permite que el texto de búsqueda los contenga
// sin romper el query (mismo helper que ya usa CustomersTab en /admin/team).
function escapeIlikePattern(term: string): string {
  return `"%${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`
}

interface BookingsSearchParams {
  status?: string
  q?: string
  from?: string
  to?: string
  sort?: string
  dir?: string
  page?: string
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: BookingsSearchParams
}) {
  const user = await requireRole(
    'super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting',
  )

  const t = getDict().admin.bookingsList
  const statusLabels = getDict().admin.bookingStatuses
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  if (!user.company_id) {
    return (
      <div className="p-8">
        <p className="text-sm text-sl-on-surface-muted">{t.noCompany}</p>
      </div>
    )
  }

  const admin      = createAdminClient()
  const companyId  = user.company_id
  const filterStatus = searchParams.status as BookingStatus | undefined
  const q = (searchParams.q ?? '').trim()
  const from = searchParams.from ?? ''
  const to = searchParams.to ?? ''
  const sortKey = searchParams.sort && SORT_COLUMNS[searchParams.sort] ? searchParams.sort : DEFAULT_SORT
  const sortDir: 'asc' | 'desc' = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const sortColumn = SORT_COLUMNS[sortKey]
  const hasSearchFilters = !!(q || from || to)

  function buildHref(overrides: {
    status?: BookingStatus | null
    sort?: string
    dir?: 'asc' | 'desc'
    page?: number
  }): string {
    const params = new URLSearchParams()
    const targetStatus = overrides.status !== undefined ? overrides.status : filterStatus
    if (targetStatus) params.set('status', targetStatus)
    if (q) params.set('q', q)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const targetSort = overrides.sort ?? sortKey
    const targetDir = overrides.dir ?? sortDir
    if (targetSort !== DEFAULT_SORT) params.set('sort', targetSort)
    if (targetDir !== 'desc') params.set('dir', targetDir)
    const targetPage = overrides.page ?? 1
    if (targetPage > 1) params.set('page', String(targetPage))
    const qs = params.toString()
    return qs ? `/admin/bookings?${qs}` : '/admin/bookings'
  }

  function clearSearchHref(): string {
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (sortKey !== DEFAULT_SORT) params.set('sort', sortKey)
    if (sortDir !== 'desc') params.set('dir', sortDir)
    const qs = params.toString()
    return qs ? `/admin/bookings?${qs}` : '/admin/bookings'
  }

  function sortHref(key: string): string {
    const nextDir: 'asc' | 'desc' = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'
    return buildHref({ sort: key, dir: nextDir, page: 1 })
  }

  // Stats por estado — counts vía head:true (no transfiere filas). Antes se
  // traían TODAS las reservas de la empresa solo para tallarlas en memoria,
  // lo cual además de lento se topaba con el límite silencioso de 1000 filas
  // de PostgREST: empresas con más de 1000 reservas veían contadores
  // incorrectos sin ningún aviso.
  const [totalCountResult, ...statusCountResults] = await Promise.all([
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    ...ALL_STATUSES.map((s) =>
      admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', s)
    ),
  ])
  const totalCount = totalCountResult.count ?? 0
  const counts: Record<string, number> = {}
  ALL_STATUSES.forEach((s, i) => {
    counts[s] = statusCountResults[i].count ?? 0
  })

  // Lista filtrada + paginada — .range() en vez de .limit(100) fijo, para no
  // saturar la página ni el navegador cuando una empresa acumula mucho
  // volumen de reservas; { count: 'exact' } calcula el total de páginas.
  let query = admin
    .from('bookings')
    .select('id, booking_number, status, type, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, total_amount, currency, vehicle_type_id, driver_id, rating', { count: 'exact' })
    .eq('company_id', companyId)

  if (filterStatus) {
    query = query.eq('status', filterStatus)
  }
  if (q) {
    const pattern = escapeIlikePattern(q)
    query = query.or(`passenger_name.ilike.${pattern},passenger_phone.ilike.${pattern}`)
  }
  if (from) query = query.gte('scheduled_at', `${from}T00:00:00`)
  if (to) query = query.lte('scheduled_at', `${to}T23:59:59`)

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const offset = (page - 1) * BOOKINGS_PAGE_SIZE

  const { data: bookings, count: filteredCount } = await query
    .order(sortColumn, { ascending: sortDir === 'asc' })
    .range(offset, offset + BOOKINGS_PAGE_SIZE - 1)

  const filteredTotal = filteredCount ?? 0
  const totalPages = Math.max(1, Math.ceil(filteredTotal / BOOKINGS_PAGE_SIZE))

  // Método de pago por reserva — para cada booking_id nos quedamos con el
  // pago exitoso más reciente (o, si no hubo ninguno exitoso, el más
  // reciente en cualquier estado) para mostrar efectivo/tarjeta/Zelle/etc.
  const bookingIds = (bookings ?? []).map((b) => b.id)
  const { data: paymentsData } = bookingIds.length
    ? await admin
        .from('payments')
        .select('booking_id, payment_method, status, metadata, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false })
    : { data: [] as { booking_id: string | null; payment_method: string; status: string; metadata: unknown; created_at: string }[] }

  const succeededPaymentByBooking = new Map<string, { payment_method: string; metadata: unknown }>()
  const anyPaymentByBooking = new Map<string, { payment_method: string; metadata: unknown }>()
  for (const p of paymentsData ?? []) {
    if (!p.booking_id) continue
    if (!anyPaymentByBooking.has(p.booking_id)) anyPaymentByBooking.set(p.booking_id, p)
    if (p.status === 'succeeded' && !succeededPaymentByBooking.has(p.booking_id)) succeededPaymentByBooking.set(p.booking_id, p)
  }

  function paymentInfo(bookingId: string): { label: string; kind: 'cash' | 'digital' | 'none' } {
    const p = succeededPaymentByBooking.get(bookingId) ?? anyPaymentByBooking.get(bookingId)
    if (!p) return { label: t.paymentPending, kind: 'none' }
    const meta = (p.metadata ?? {}) as { method?: string }
    if (p.payment_method === 'cash') return { label: t.paymentCash, kind: 'cash' }
    if (p.payment_method === 'bank_transfer') return { label: meta.method === 'zelle' ? t.paymentZelle : t.paymentTransfer, kind: 'digital' }
    if (p.payment_method === 'corporate_account') return { label: t.paymentCorporate, kind: 'digital' }
    return { label: t.paymentCard, kind: 'digital' }
  }

  const totalActive = (counts['pending'] ?? 0) + (counts['assigned'] ?? 0) +
    (counts['en_route'] ?? 0) + (counts['arrived'] ?? 0) + (counts['in_progress'] ?? 0)

  function SortHeader({ label, sortKeyName, align }: { label: string; sortKeyName: string; align?: 'right' }) {
    const active = sortKey === sortKeyName
    return (
      <th className={`px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <Link
          href={sortHref(sortKeyName)}
          className={`inline-flex items-center gap-1 hover:text-sl-on-surface transition-colors ${active ? 'text-bronze' : ''}`}
        >
          {label}
          {active ? (
            sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
          ) : (
            <ArrowUpDown size={10} className="opacity-30" />
          )}
        </Link>
      </th>
    )
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">
            {t.summary.replace('{total}', String(totalCount)).replace('{active}', String(totalActive))}
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-gray-900 text-sm font-semibold rounded-xl hover:bg-gold/90 shadow-sm transition-colors"
        >
          <Plus size={16} strokeWidth={2.25} />
          {t.newBooking}
        </Link>
      </div>

      {/* Stat pills por estado */}
      <div className="flex flex-wrap items-center gap-1 bg-white border border-sl-outline-variant rounded-full p-1.5 w-fit">
        <Link
          href={buildHref({ status: null, page: 1 })}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            !filterStatus ? 'bg-gold text-gray-900 shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
          }`}
        >
          {t.all} ({totalCount})
        </Link>
        {ALL_STATUSES.map((s) => (
          counts[s] ? (
            <Link
              key={s}
              href={buildHref({ status: s, page: 1 })}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filterStatus === s ? 'bg-gold text-gray-900 shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
              }`}
            >
              {statusLabels[s]} ({counts[s]})
            </Link>
          ) : null
        ))}
      </div>

      {/* Búsqueda por pasajero + rango de fechas */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        {filterStatus && <input type="hidden" name="status" value={filterStatus} />}
        {sortKey !== DEFAULT_SORT && <input type="hidden" name="sort" value={sortKey} />}
        {sortDir !== 'desc' && <input type="hidden" name="dir" value={sortDir} />}
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.colPassenger}</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.fromLabel}</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.toLabel}</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <button type="submit" className="px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-all">
          {t.filterButton}
        </button>
        {hasSearchFilters && (
          <Link href={clearSearchHref()} className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface">
            {t.clearFilters}
          </Link>
        )}
      </form>

      {/* Tabla */}
      {!bookings?.length ? (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">
            {filterStatus
              ? t.emptyFiltered.replace('{status}', statusLabels[filterStatus])
              : hasSearchFilters
                ? t.noResultsFiltered
                : t.empty}
          </p>
          <Link
            href="/admin/bookings/new"
            className="mt-4 inline-block text-sm text-bronze hover:underline"
          >
            {t.createFirst}
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20">
                <SortHeader label={t.colNumber} sortKeyName="number" />
                <SortHeader label={t.colPassenger} sortKeyName="passenger" />
                <SortHeader label={t.colStatus} sortKeyName="status" />
                <SortHeader label={t.colDateTime} sortKeyName="datetime" />
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colPickup}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colDropoff}</th>
                <SortHeader label={t.colTotal} sortKeyName="total" align="right" />
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colPayment}</th>
                <SortHeader label={t.colRating} sortKeyName="rating" />
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-sl-bg/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs text-bronze hover:underline">
                      {b.booking_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-sl-on-surface">{b.passenger_name ?? '—'}</p>
                    {b.passenger_phone && (
                      <p className="text-[11px] text-sl-on-surface-muted">{b.passenger_phone}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <BookingStatusBadge status={b.status as BookingStatus} labels={statusLabels} />
                  </td>
                  <td className="px-6 py-4 text-sl-on-surface-muted">
                    {formatDate(b.scheduled_at, localeTag)}
                  </td>
                  <td className="px-6 py-4 text-sl-on-surface max-w-[180px] truncate">
                    {shortAddress(b.pickup_location)}
                  </td>
                  <td className="px-6 py-4 text-sl-on-surface max-w-[180px] truncate">
                    {shortAddress(b.dropoff_location)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-sl-on-surface">
                    {b.total_amount != null
                      ? `$${Number(b.total_amount).toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const payment = paymentInfo(b.id)
                      const badgeCls = payment.kind === 'cash'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : payment.kind === 'digital'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                      return (
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
                          {payment.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sl-on-surface-muted">
                    {b.rating != null ? (
                      <span className="text-bronze font-medium">★ {b.rating}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-sl-outline-variant text-xs text-sl-on-surface-muted">
              {page > 1 ? (
                <Link href={buildHref({ page: page - 1 })} className="text-bronze hover:text-bronze/80">{t.prevPage}</Link>
              ) : <span />}
              <span>{t.pageInfo.replace('{page}', String(page)).replace('{total}', String(totalPages))}</span>
              {page < totalPages ? (
                <Link href={buildHref({ page: page + 1 })} className="text-bronze hover:text-bronze/80">{t.nextPage}</Link>
              ) : <span />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
