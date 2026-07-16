import type { Metadata } from 'next'
import Link from 'next/link'
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

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { status?: string }
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

  // Lista filtrada
  let query = admin
    .from('bookings')
    .select('id, booking_number, status, type, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, total_amount, currency, vehicle_type_id, driver_id, rating')
    .eq('company_id', companyId)
    .order('scheduled_at', { ascending: false })
    .limit(100)

  if (filterStatus) {
    query = query.eq('status', filterStatus)
  }

  const { data: bookings } = await query

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

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.title}</h1>
          <p className="text-sm text-sl-on-surface-muted mt-1">
            {t.summary.replace('{total}', String(totalCount)).replace('{active}', String(totalActive))}
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="px-4 py-2 bg-[#0071e3] text-white text-sm font-medium rounded-xl hover:bg-[#0077ed] transition-colors"
        >
          {t.newBooking}
        </Link>
      </div>

      {/* Stat pills por estado */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/bookings"
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !filterStatus
              ? 'bg-[#1d1d1f] text-white'
              : 'bg-sl-surface-high border border-sl-outline-variant text-sl-on-surface-muted hover:border-[#0071e3]'
          }`}
        >
          {t.all} ({totalCount})
        </Link>
        {ALL_STATUSES.map((s) => (
          counts[s] ? (
            <Link
              key={s}
              href={`/admin/bookings?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filterStatus === s
                  ? 'bg-[#1d1d1f] text-white'
                  : 'bg-sl-surface-high border border-sl-outline-variant text-sl-on-surface-muted hover:border-[#0071e3]'
              }`}
            >
              {statusLabels[s]} ({counts[s]})
            </Link>
          ) : null
        ))}
      </div>

      {/* Tabla */}
      {!bookings?.length ? (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">
            {filterStatus ? t.emptyFiltered.replace('{status}', statusLabels[filterStatus]) : t.empty}
          </p>
          <Link
            href="/admin/bookings/new"
            className="mt-4 inline-block text-sm text-[#0071e3] hover:underline"
          >
            {t.createFirst}
          </Link>
        </div>
      ) : (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colNumber}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colPassenger}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colStatus}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colDateTime}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colPickup}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colDropoff}</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colTotal}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colPayment}</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colRating}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, idx) => (
                <tr
                  key={b.id}
                  className={`border-b border-sl-outline-variant last:border-0 hover:bg-sl-bg/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-sl-bg/20'}`}
                >
                  <td className="px-5 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs text-[#0071e3] hover:underline">
                      {b.booking_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-sl-on-surface">{b.passenger_name ?? '—'}</p>
                    {b.passenger_phone && (
                      <p className="text-[11px] text-sl-on-surface-muted">{b.passenger_phone}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <BookingStatusBadge status={b.status as BookingStatus} labels={statusLabels} />
                  </td>
                  <td className="px-5 py-3 text-sl-on-surface-muted">
                    {formatDate(b.scheduled_at, localeTag)}
                  </td>
                  <td className="px-5 py-3 text-sl-on-surface max-w-[180px] truncate">
                    {shortAddress(b.pickup_location)}
                  </td>
                  <td className="px-5 py-3 text-sl-on-surface max-w-[180px] truncate">
                    {shortAddress(b.dropoff_location)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-sl-on-surface">
                    {b.total_amount != null
                      ? `$${Number(b.total_amount).toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="px-5 py-3">
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
                  <td className="px-5 py-3 text-sl-on-surface-muted">
                    {b.rating != null ? (
                      <span className="text-bronze font-medium">★ {b.rating}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
