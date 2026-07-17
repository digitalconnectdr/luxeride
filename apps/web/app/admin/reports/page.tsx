import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Reportes' }
export const dynamic = 'force-dynamic'

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? fallback : d
}

const inputCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const user = await requireRole('company_owner', 'company_admin', 'accounting')
  if (!user.company_id) {
    return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>
  }

  // Rango: por defecto el mes actual
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const from = parseDate(searchParams.from, monthStart)
  const toRaw = parseDate(searchParams.to, new Date())
  // Incluir el día "to" completo
  const to = new Date(toRaw)
  to.setHours(23, 59, 59, 999)

  const admin = createAdminClient()
  const { data: bookings } = await admin
    .from('bookings')
    .select('id, booking_number, status, scheduled_at, completed_at, total_amount, currency, driver_id, type, created_at')
    .eq('company_id', user.company_id)
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())
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

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)
  const csvUrl = `/api/reports/bookings?from=${fmtDate(from)}&to=${fmtDate(to)}`

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
            Ingresos y operación del {from.toLocaleDateString('es-DO')} al {to.toLocaleDateString('es-DO')}.
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
          <input type="date" name="from" defaultValue={fmtDate(from)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">Hasta</label>
          <input type="date" name="to" defaultValue={fmtDate(to)} className={inputCls} />
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
        {[
          { label: 'Ingresos (completados)', value: `$${totalRevenue.toFixed(2)}` },
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
