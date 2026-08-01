import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'
import { computeAccountSla } from '@/lib/corporate/sla'
import { BookingsTrendChart } from '@/components/admin/dashboard/bookings-trend-chart'
import { getBookingsTrendAction } from '@/app/actions/dashboard'
import { addIsoDays, getZonedIsoDate, isoDateStartOfMonth, zonedMidnightUtc } from '@/lib/time/zoned-bounds'

export const metadata: Metadata = { title: 'Reportes' }
export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const inputCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

type ChannelKey = 'direct' | 'corporate' | 'partner' | 'affiliate'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const user = await requireRole('company_owner', 'company_admin', 'accounting')
  if (!user.company_id) {
    return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>
  }

  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.admin.reports
  const typeLabels = dict.admin.bookingDetail.types as Record<string, string>

  const admin = createAdminClient()
  const { data: companyRow } = await admin.from('companies').select('timezone').eq('id', user.company_id).single()
  const timezone = companyRow?.timezone

  // Rango: por defecto el mes actual — límites en la zona horaria de la
  // EMPRESA, no en UTC del servidor (mismo criterio que el dashboard: ver
  // lib/time/zoned-bounds.ts). `to` se guarda como el INICIO del día
  // siguiente (límite exclusivo) para cubrir el día completo sin adivinar
  // "23:59:59.999" en la zona equivocada.
  const todayIso = getZonedIsoDate(new Date(), timezone)
  const fromIso = searchParams.from && ISO_DATE_RE.test(searchParams.from) ? searchParams.from : isoDateStartOfMonth(todayIso)
  const toIso = searchParams.to && ISO_DATE_RE.test(searchParams.to) ? searchParams.to : todayIso
  const from = zonedMidnightUtc(fromIso, timezone)
  const to = zonedMidnightUtc(addIsoDays(toIso, 1), timezone)

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, booking_number, status, scheduled_at, arrived_at, completed_at, total_amount, currency, driver_id, type, created_at, corporate_account_id, partner_id')
    .eq('company_id', user.company_id)
    .gte('scheduled_at', from.toISOString())
    .lt('scheduled_at', to.toISOString())
    .order('scheduled_at')

  const all = bookings ?? []
  const completed = all.filter((b) => b.status === 'completed')
  const cancelled = all.filter((b) => ['cancelled', 'no_show'].includes(b.status))

  const totalRevenue = completed.reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
  const avgFare = completed.length > 0 ? totalRevenue / completed.length : 0
  const cancelRate = all.length > 0 ? (cancelled.length / all.length) * 100 : 0

  // Por estado
  const byStatus = new Map<string, { count: number; amount: number }>()
  for (const b of all) {
    const e = byStatus.get(b.status) ?? { count: 0, amount: 0 }
    e.count += 1
    e.amount += Number(b.total_amount ?? 0)
    byStatus.set(b.status, e)
  }

  // Top conductores (viajes completados)
  const byDriver = new Map<string, { count: number; amount: number }>()
  for (const b of completed) {
    if (!b.driver_id) continue
    const e = byDriver.get(b.driver_id) ?? { count: 0, amount: 0 }
    e.count += 1
    e.amount += Number(b.total_amount ?? 0)
    byDriver.set(b.driver_id, e)
  }
  const topDriverIds = [...byDriver.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5)

  const driverNames = new Map<string, string>()
  if (topDriverIds.length > 0) {
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', topDriverIds.map(([id]) => id))
    for (const p of profiles ?? []) driverNames.set(p.id, `${p.first_name} ${p.last_name}`)
  }

  // ── Ingresos por canal ──────────────────────────────────────────────────
  // corporate/partner ya vienen marcados directo en bookings; affiliate se
  // detecta por presencia en affiliate_trips (no hay flag propio en bookings).
  const affiliateBookingIds = new Set<string>()
  if (all.length > 0) {
    const { data: affRows } = await admin
      .from('affiliate_trips')
      .select('booking_id')
      .in('booking_id', all.map((b) => b.id))
    for (const r of affRows ?? []) affiliateBookingIds.add(r.booking_id)
  }
  const channelOf = (b: { corporate_account_id: string | null; partner_id: string | null; id: string }): ChannelKey => {
    if (b.corporate_account_id) return 'corporate'
    if (b.partner_id) return 'partner'
    if (affiliateBookingIds.has(b.id)) return 'affiliate'
    return 'direct'
  }
  const byChannel = new Map<ChannelKey, { count: number; amount: number }>()
  for (const b of completed) {
    const ch = channelOf(b)
    const e = byChannel.get(ch) ?? { count: 0, amount: 0 }
    e.count += 1
    e.amount += Number(b.total_amount ?? 0)
    byChannel.set(ch, e)
  }
  const channelOrder: ChannelKey[] = ['direct', 'corporate', 'affiliate', 'partner']

  // ── Comparación vs. período anterior (mismo largo de rango) ─────────────
  const rangeMs = to.getTime() - from.getTime()
  const prevTo = from
  const prevFrom = new Date(from.getTime() - rangeMs)
  const { data: prevBookings } = await admin
    .from('bookings')
    .select('total_amount, status')
    .eq('company_id', user.company_id)
    .gte('scheduled_at', prevFrom.toISOString())
    .lt('scheduled_at', prevTo.toISOString())
  const prevRevenue = (prevBookings ?? [])
    .filter((b) => b.status === 'completed')
    .reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
  const revenueDeltaPct = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null

  // ── Gráfico de tendencia (rangos propios, independiente del filtro de la página) ──
  const trendResult = await getBookingsTrendAction('this_week')
  const initialTrend = trendResult.success ? (trendResult.data ?? []) : []

  // ── Desglose por tipo de reserva ─────────────────────────────────────────
  const byType = new Map<string, { count: number; amount: number }>()
  for (const b of completed) {
    const e = byType.get(b.type) ?? { count: 0, amount: 0 }
    e.count += 1
    e.amount += Number(b.total_amount ?? 0)
    byType.set(b.type, e)
  }

  // ── Puntualidad de flota agregada ────────────────────────────────────────
  const fleetSla = computeAccountSla(
    all.map((b) => ({ status: b.status, scheduled_at: b.scheduled_at, arrived_at: b.arrived_at }))
  )

  // ── Facturación corporativa pendiente/vencida ────────────────────────────
  const { data: corpAccounts } = await admin
    .from('corporate_accounts')
    .select('id')
    .eq('company_id', user.company_id)
    .limit(1)
  const hasCorporateAccounts = (corpAccounts ?? []).length > 0
  let corporateBilling: { pendingAmount: number; pendingCount: number; overdueAmount: number; overdueCount: number } | null = null
  if (hasCorporateAccounts) {
    const { data: invoices } = await admin
      .from('invoices')
      .select('status, total_amount')
      .eq('company_id', user.company_id)
      .not('corporate_account_id', 'is', null)
      .in('status', ['sent', 'overdue'])
    const pendingRows = (invoices ?? []).filter((i) => i.status === 'sent')
    const overdueRows = (invoices ?? []).filter((i) => i.status === 'overdue')
    corporateBilling = {
      pendingAmount: pendingRows.reduce((s, i) => s + Number(i.total_amount ?? 0), 0),
      pendingCount: pendingRows.length,
      overdueAmount: overdueRows.reduce((s, i) => s + Number(i.total_amount ?? 0), 0),
      overdueCount: overdueRows.length,
    }
  }

  const csvUrl = `/api/reports/bookings?from=${fromIso}&to=${toIso}`

  const STATUS_LABELS: Record<string, string> = {
    quote: 'Cotización', pending: 'Pendiente', assigned: 'Asignado', en_route: 'En ruta',
    arrived: 'Llegó', in_progress: 'En viaje', completed: 'Completado',
    cancelled: 'Cancelado', no_show: 'No show', failed: 'Fallido',
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">Reportes</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">
            Ingresos y operación del {new Date(`${fromIso}T00:00:00`).toLocaleDateString('es-DO')} al {new Date(`${toIso}T00:00:00`).toLocaleDateString('es-DO')}.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white border border-bronze/40 text-sl-on-surface rounded-xl hover:border-bronze hover:bg-bronze/5 transition-colors"
          >
            Audit Log
          </Link>
          <a
            href={csvUrl}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 shadow-sm transition-colors"
          >
            ↓ Exportar CSV
          </a>
        </div>
      </div>

      {/* Filtro de fechas */}
      <form method="get" className="flex items-end gap-3 bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-4">
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">Desde</label>
          <input type="date" name="from" defaultValue={fromIso} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">Hasta</label>
          <input type="date" name="to" defaultValue={toIso} className={inputCls} />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
        >
          Aplicar
        </button>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Ingresos (completados)
          </p>
          <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-2">${totalRevenue.toFixed(2)}</p>
          {revenueDeltaPct === null ? (
            <p className="text-xs text-sl-on-surface-muted mt-1">{t.noPreviousData}</p>
          ) : (
            <p className={`text-xs font-semibold mt-1 ${revenueDeltaPct >= 0 ? 'text-emerald-600' : 'text-error'}`}>
              {revenueDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(revenueDeltaPct).toFixed(1)}% {t.vsPreviousPeriod}
            </p>
          )}
        </div>
        {[
          { label: 'Viajes completados', value: String(completed.length) },
          { label: 'Tarifa promedio', value: `$${avgFare.toFixed(2)}` },
          { label: 'Tasa de cancelación', value: `${cancelRate.toFixed(1)}%` },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              {c.label}
            </p>
            <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-2">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de tendencia */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
        <BookingsTrendChart
          title={t.trend.title}
          initialData={initialTrend}
          rangeLabels={{
            this_week: dict.adminDashboard.trendRangeThisWeek,
            last_week: dict.adminDashboard.trendRangeLastWeek,
            last_30: dict.adminDashboard.trendRangeLast30,
            last_90: dict.adminDashboard.trendRangeLast90,
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ingresos por canal */}
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gold/20">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              {t.byChannel.title}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-sl-outline-variant/50">
                {channelOrder.map((ch) => {
                  const e = byChannel.get(ch) ?? { count: 0, amount: 0 }
                  return (
                    <tr key={ch}>
                      <td className="px-6 py-3 text-sl-on-surface">{t.byChannel[ch]}</td>
                      <td className="px-6 py-3 text-right text-sl-on-surface-muted">{e.count}</td>
                      <td className="px-6 py-3 text-right font-medium text-sl-on-surface">${e.amount.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desglose por tipo de reserva */}
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gold/20">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              {t.byType.title}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-sl-outline-variant/50">
                {[...byType.entries()]
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([type, e]) => (
                    <tr key={type}>
                      <td className="px-6 py-3 text-sl-on-surface">{typeLabels[type] ?? type}</td>
                      <td className="px-6 py-3 text-right text-sl-on-surface-muted">{e.count}</td>
                      <td className="px-6 py-3 text-right font-medium text-sl-on-surface">${e.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                {byType.size === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-sl-on-surface-muted">
                      Sin datos en el rango seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Puntualidad de flota */}
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-4">
            {t.fleetSla.title}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-sl-on-surface-muted">{t.fleetSla.punctuality}</p>
              <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-1">
                {fleetSla.punctualityPct === null ? '—' : `${fleetSla.punctualityPct}%`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-sl-on-surface-muted">{t.fleetSla.cancellation}</p>
              <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-1">
                {fleetSla.cancellationPct === null ? '—' : `${fleetSla.cancellationPct}%`}
              </p>
            </div>
          </div>
          {fleetSla.punctualityPct === null && (
            <p className="text-xs text-sl-on-surface-muted mt-3">{t.fleetSla.noData}</p>
          )}
        </div>

        {/* Facturación corporativa pendiente/vencida */}
        {corporateBilling && (
          <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-4">
              {t.corporateBilling.title}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-sl-on-surface-muted">{t.corporateBilling.pending}</p>
                <p className="text-2xl font-playfair font-semibold text-sl-on-surface mt-1">
                  ${corporateBilling.pendingAmount.toFixed(2)}
                </p>
                <p className="text-xs text-sl-on-surface-muted mt-0.5">{corporateBilling.pendingCount}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-sl-on-surface-muted">{t.corporateBilling.overdue}</p>
                <p className="text-2xl font-playfair font-semibold text-error mt-1">
                  ${corporateBilling.overdueAmount.toFixed(2)}
                </p>
                <p className="text-xs text-sl-on-surface-muted mt-0.5">{corporateBilling.overdueCount}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Por estado */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gold/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Reservaciones por estado ({all.length} total)
          </p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-sl-outline-variant/50">
            {[...byStatus.entries()]
              .sort((a, b) => b[1].count - a[1].count)
              .map(([status, e]) => (
                <tr key={status}>
                  <td className="px-6 py-3 text-sl-on-surface">{STATUS_LABELS[status] ?? status}</td>
                  <td className="px-6 py-3 text-right text-sl-on-surface-muted">{e.count}</td>
                  <td className="px-6 py-3 text-right font-medium text-sl-on-surface">
                    ${e.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            {all.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-6 text-center text-sl-on-surface-muted">
                  Sin datos en el rango seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Top conductores */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gold/20">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Top conductores (por ingresos)
          </p>
        </div>
        {topDriverIds.length === 0 ? (
          <p className="p-6 text-sm text-sl-on-surface-muted text-center">
            Sin viajes completados con conductor asignado.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-sl-outline-variant/50">
              {topDriverIds.map(([driverId, e], i) => (
                <tr key={driverId}>
                  <td className="px-6 py-3 text-sl-on-surface">
                    <span className="text-sl-on-surface-muted mr-2">#{i + 1}</span>
                    {driverNames.get(driverId) ?? driverId.slice(0, 8)}
                  </td>
                  <td className="px-6 py-3 text-right text-sl-on-surface-muted">{e.count} viajes</td>
                  <td className="px-6 py-3 text-right font-medium text-sl-on-surface">
                    ${e.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
