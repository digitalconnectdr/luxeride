import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import type { CompanyStatus, CompanyPlan, BookingStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Cuadro de mando — Super Admin' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<CompanyStatus, string> = {
  active:    'bg-green-100 text-green-700',
  trial:     'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
}
const STATUS_LABEL: Record<CompanyStatus, string> = {
  active: 'Activa', trial: 'Prueba', suspended: 'Suspendida', cancelled: 'Cancelada',
}
const PLAN_LABEL: Record<CompanyPlan, string> = {
  free: 'Free', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
}
const TREND_DAYS = 14
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress']

function StatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function SuperAdminDashboardPage() {
  const admin = createAdminClient()

  const now = new Date()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)
  const in7Days = new Date(now.getTime() + 7 * 86_400_000)
  const trendStart = new Date(todayStart.getTime() - (TREND_DAYS - 1) * 86_400_000)

  const [
    { data: companiesRaw },
    { data: planPrices },
    { data: completedBookings },
    { count: cancelledCount30 },
    { count: noShowCount30 },
    { count: activeBookingsCount },
    { count: totalBookingsAllTime },
    { data: payments30 },
    { count: totalDrivers },
    { count: availableDriversNow },
    { count: totalVehicles },
    { data: driverCompanyRows },
  ] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, slug, status, plan, created_at, city, country, stripe_connect_onboarded, trial_ends_at, subscription_ends_at')
      .order('created_at', { ascending: false }),
    admin.from('plan_quotas').select('plan, monthly_price'),
    admin
      .from('bookings')
      .select('total_amount, completed_at, company_id')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10_000),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').gte('cancelled_at', thirtyDaysAgo.toISOString()),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'no_show').gte('no_show_at', thirtyDaysAgo.toISOString()),
    admin.from('bookings').select('id', { count: 'exact', head: true }).in('status', ACTIVE_BOOKING_STATUSES),
    admin.from('bookings').select('id', { count: 'exact', head: true }),
    admin.from('payments').select('amount, status, payment_method, created_at').gte('created_at', thirtyDaysAgo.toISOString()).limit(5000),
    admin.from('drivers').select('id', { count: 'exact', head: true }),
    admin.from('drivers').select('id', { count: 'exact', head: true }).eq('is_available', true),
    admin.from('vehicles').select('id', { count: 'exact', head: true }),
    admin.from('drivers').select('company_id'),
  ])

  const companies = companiesRaw ?? []
  const completed = completedBookings ?? []
  const payments = payments30 ?? []

  // ── A. Negocio LuxeRide (SaaS) ────────────────────────────────────────────
  const priceByPlan = new Map((planPrices ?? []).map((p) => [p.plan, p.monthly_price]))
  const active = companies.filter((c) => c.status === 'active')
  const trial = companies.filter((c) => c.status === 'trial')
  const suspended = companies.filter((c) => c.status === 'suspended')
  const cancelled = companies.filter((c) => c.status === 'cancelled')
  const mrr = active.reduce((s, c) => s + Number(priceByPlan.get(c.plan) ?? 0), 0)
  const arpu = active.length ? mrr / active.length : 0
  const newThisWeek = companies.filter((c) => c.created_at >= sevenDaysAgo.toISOString()).length
  const newThisMonth = companies.filter((c) => c.created_at >= monthStart.toISOString()).length
  const planCounts = new Map<CompanyPlan, number>()
  for (const c of active) planCounts.set(c.plan, (planCounts.get(c.plan) ?? 0) + 1)
  const trialsExpiringSoon = trial.filter((c) => c.trial_ends_at && c.trial_ends_at <= in7Days.toISOString())
  const subsExpiringSoon = active.filter((c) => c.subscription_ends_at && c.subscription_ends_at <= in7Days.toISOString())

  // ── B. Plataforma: volumen y GMV (todas las empresas) ─────────────────────
  const gmvAllTime = completed.reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
  const completedThisMonth = completed.filter((b) => b.completed_at && b.completed_at >= monthStart.toISOString())
  const gmvMonth = completedThisMonth.reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
  const gmvToday = completed
    .filter((b) => b.completed_at && b.completed_at >= todayStart.toISOString())
    .reduce((s, b) => s + Number(b.total_amount ?? 0), 0)
  const completedCount30 = completed.filter((b) => b.completed_at && b.completed_at >= thirtyDaysAgo.toISOString()).length
  const cancellationDenominator = completedCount30 + (cancelledCount30 ?? 0) + (noShowCount30 ?? 0)
  const cancellationRate30 = cancellationDenominator ? ((cancelledCount30 ?? 0) + (noShowCount30 ?? 0)) / cancellationDenominator : 0
  const avgBookingValue = completed.length ? gmvAllTime / completed.length : 0

  const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const dayStart = new Date(trendStart.getTime() + i * 86_400_000)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const dayBookings = completed.filter((b) => b.completed_at && b.completed_at >= dayStart.toISOString() && b.completed_at < dayEnd.toISOString())
    return {
      label: dayStart.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit' }),
      count: dayBookings.length,
      gmv: dayBookings.reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
    }
  })
  const trendMax = Math.max(1, ...trend.map((d) => d.count))

  // ── C. Top empresas por GMV este mes ───────────────────────────────────────
  const gmvByCompany = new Map<string, { gmv: number; count: number }>()
  for (const b of completedThisMonth) {
    if (!b.company_id) continue
    const cur = gmvByCompany.get(b.company_id) ?? { gmv: 0, count: 0 }
    cur.gmv += Number(b.total_amount ?? 0)
    cur.count += 1
    gmvByCompany.set(b.company_id, cur)
  }
  const companyById = new Map(companies.map((c) => [c.id, c]))
  const topCompanies = Array.from(gmvByCompany.entries())
    .map(([companyId, stats]) => ({ company: companyById.get(companyId), ...stats }))
    .filter((r) => r.company)
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 8)

  // ── D. Pagos (Stripe) — últimos 30 días ────────────────────────────────────
  const succeededPayments = payments.filter((p) => p.status === 'succeeded')
  const failedPayments = payments.filter((p) => p.status === 'failed')
  const succeededVolume = succeededPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const failureRate = payments.length ? failedPayments.length / payments.length : 0
  const methodCounts = new Map<string, number>()
  for (const p of succeededPayments) methodCounts.set(p.payment_method, (methodCounts.get(p.payment_method) ?? 0) + 1)
  const companiesWithoutConnect = active.filter((c) => !c.stripe_connect_onboarded)

  // ── E. Flota y conductores (plataforma) ────────────────────────────────────
  const companiesWithDrivers = new Set((driverCompanyRows ?? []).map((d) => d.company_id))
  const companiesWithoutDrivers = active.filter((c) => !companiesWithDrivers.has(c.id))

  const card = 'bg-white border border-[#e5e1d8] rounded-xl'

  return (
    <div className="min-h-full bg-[#f6f4ef] p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-playfair text-3xl font-semibold text-[#1d1b18]">Cuadro de mando</h1>
            <p className="text-sm text-[#75716a] mt-1">Visión completa de LuxeRide como plataforma</p>
          </div>
          <p className="text-xs font-medium text-[#8a6520] capitalize">
            {now.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* ── A. Negocio LuxeRide ── */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">Negocio LuxeRide</p>

          <div className={`${card} border-l-[3px] border-l-[#8a6520] rounded-l-none px-6 py-5 flex flex-wrap items-center gap-x-10 gap-y-4`}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">MRR</p>
              <p className="text-4xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(mrr)}</p>
              <p className="text-[11px] text-[#75716a] mt-0.5">{active.length} empresa{active.length === 1 ? '' : 's'} activa{active.length === 1 ? '' : 's'} pagando</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">ARPU</p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(arpu)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div className="flex items-center gap-4 flex-wrap">
              {(['starter', 'professional', 'enterprise'] as CompanyPlan[]).map((plan) => (
                <div key={plan}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">{PLAN_LABEL[plan]}</p>
                  <p className="text-lg font-playfair font-semibold text-[#1d1b18] mt-0.5">{planCounts.get(plan) ?? 0}</p>
                </div>
              ))}
            </div>
            <Link href="/super-admin/tracking" className="ml-auto text-xs font-medium text-[#8a6520] hover:underline">
              Editar precios por plan →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: 'Total empresas', value: companies.length, href: '/super-admin/companies' },
              { label: 'Activas',        value: active.length,    href: '/super-admin/companies?status=active' },
              { label: 'En prueba',      value: trial.length,     href: '/super-admin/subscriptions' },
              { label: 'Suspendidas',    value: suspended.length, href: '/super-admin/companies?status=suspended', accent: suspended.length > 0 },
              { label: 'Nuevas (7 d)',   value: newThisWeek,      href: '/super-admin/companies' },
              { label: 'Nuevas (mes)',   value: newThisMonth,     href: '/super-admin/companies' },
            ].map((k) => (
              <Link
                key={k.label}
                href={k.href}
                className={`${card} px-4 py-3.5 hover:border-[#8a6520]/50 transition-colors group`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">{k.label}</p>
                <p className={`text-2xl font-playfair font-semibold mt-1 transition-colors group-hover:text-[#8a6520] ${k.accent ? 'text-red-500' : 'text-[#1d1b18]'}`}>
                  {k.value}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── B. Plataforma: volumen y GMV ── */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">Plataforma — volumen y GMV (todas las empresas)</p>

          <div className={`${card} border-l-[3px] border-l-[#8a6520] rounded-l-none px-6 py-5 flex flex-wrap items-center gap-x-10 gap-y-4`}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">GMV este mes</p>
              <p className="text-4xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(gmvMonth)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">GMV hoy</p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(gmvToday)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">GMV histórico</p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(gmvAllTime)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">Valor promedio</p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(avgBookingValue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Reservas totales', value: totalBookingsAllTime ?? 0 },
              { label: 'En curso ahora',   value: activeBookingsCount ?? 0 },
              { label: 'Completadas (30 d)', value: completedCount30 },
              { label: 'Cancel./no-show (30 d)', value: `${(cancellationRate30 * 100).toFixed(1)}%`, accent: cancellationRate30 > 0.15 },
            ].map((k) => (
              <div key={k.label} className={`${card} px-4 py-3.5`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">{k.label}</p>
                <p className={`text-2xl font-playfair font-semibold mt-1 ${'accent' in k && k.accent ? 'text-red-500' : 'text-[#1d1b18]'}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className={`${card} p-6`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] mb-4">
              Reservas completadas — últimos {TREND_DAYS} días
            </p>
            <div className="flex items-end justify-between gap-1.5">
              {trend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[9px] font-medium text-[#8a6520] h-3">{d.count || ''}</span>
                  <div className="w-full h-20 flex items-end">
                    <div
                      className="w-full rounded-t-md bg-[#8a6520]/70 transition-all"
                      style={{ height: d.count ? `${Math.max(8, (d.count / trendMax) * 100)}%` : '0%' }}
                      title={`${d.label}: ${d.count} reservas · ${money(d.gmv)}`}
                    />
                  </div>
                  <span className="text-[9px] text-[#75716a] rotate-0">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── C. Top empresas este mes ── */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">Top empresas — GMV este mes</p>
          <div className={`${card} overflow-hidden`}>
            {topCompanies.length === 0 ? (
              <p className="p-6 text-sm text-[#75716a] text-center">Sin reservas completadas este mes todavía.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0ede5]">
                    {['Empresa', 'Plan', 'Reservas', 'GMV'].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ede5]">
                  {topCompanies.map((r) => (
                    <tr key={r.company!.id} className="hover:bg-[#faf8f3] transition-colors">
                      <td className="px-6 py-3.5">
                        <Link href={`/super-admin/companies/${r.company!.id}`} className="font-medium text-[#1d1b18] hover:text-[#8a6520] transition-colors">
                          {r.company!.name}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-[#75716a] capitalize">{r.company!.plan}</td>
                      <td className="px-6 py-3.5 text-sm text-[#1d1b18]">{r.count}</td>
                      <td className="px-6 py-3.5 text-sm font-semibold text-[#1d1b18]">{money(r.gmv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── D. Pagos (Stripe) últimos 30 días ── */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">Pagos (Stripe) — últimos 30 días</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">Volumen exitoso</p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18]">{money(succeededVolume)}</p>
            </div>
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">Pagos fallidos</p>
              <p className={`text-2xl font-playfair font-semibold mt-1 ${failureRate > 0.1 ? 'text-red-500' : 'text-[#1d1b18]'}`}>
                {failedPayments.length} <span className="text-sm font-normal text-[#75716a]">({(failureRate * 100).toFixed(1)}%)</span>
              </p>
            </div>
            <div className={`${card} px-4 py-3.5 col-span-2`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] mb-1.5">Método de pago (exitosos)</p>
              {methodCounts.size === 0 ? (
                <p className="text-xs text-[#75716a]">Sin pagos en este período.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {Array.from(methodCounts.entries()).map(([method, count]) => (
                    <span key={method} className="text-xs text-[#1d1b18]">
                      <span className="font-semibold">{count}</span> <span className="text-[#75716a] capitalize">{method.replace('_', ' ')}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {companiesWithoutConnect.length > 0 && (
            <div className={`${card} px-5 py-4`}>
              <p className="text-xs text-[#75716a]">
                <span className="font-semibold text-[#1d1b18]">{companiesWithoutConnect.length}</span> empresa{companiesWithoutConnect.length === 1 ? '' : 's'} activa{companiesWithoutConnect.length === 1 ? '' : 's'} sin Stripe Connect conectado (no pueden cobrar con tarjeta directamente):{' '}
                {companiesWithoutConnect.slice(0, 6).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ', '}
                    <Link href={`/super-admin/companies/${c.id}`} className="text-[#8a6520] hover:underline">{c.name}</Link>
                  </span>
                ))}
                {companiesWithoutConnect.length > 6 && ` +${companiesWithoutConnect.length - 6} más`}
              </p>
            </div>
          )}
        </section>

        {/* ── E. Flota y conductores ── */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">Flota y conductores (plataforma)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">Conductores totales</p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18]">{totalDrivers ?? 0}</p>
            </div>
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">En servicio ahora</p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-green-600">{availableDriversNow ?? 0}</p>
            </div>
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">Vehículos totales</p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18]">{totalVehicles ?? 0}</p>
            </div>
          </div>
        </section>

        {/* ── F. Alertas y vigilancia ── */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">Alertas y vigilancia</p>
          <div className={`${card} divide-y divide-[#f0ede5]`}>
            {[
              {
                show: suspended.length > 0,
                text: `${suspended.length} empresa${suspended.length === 1 ? '' : 's'} suspendida${suspended.length === 1 ? '' : 's'}`,
                href: '/super-admin/companies?status=suspended',
                tone: 'text-red-500',
              },
              {
                show: trialsExpiringSoon.length > 0,
                text: `${trialsExpiringSoon.length} prueba${trialsExpiringSoon.length === 1 ? '' : 's'} vence${trialsExpiringSoon.length === 1 ? '' : 'n'} en ≤7 días`,
                href: '/super-admin/subscriptions',
                tone: 'text-amber-600',
              },
              {
                show: subsExpiringSoon.length > 0,
                text: `${subsExpiringSoon.length} suscripción${subsExpiringSoon.length === 1 ? '' : 'es'} vence${subsExpiringSoon.length === 1 ? '' : 'n'} en ≤7 días`,
                href: '/super-admin/subscriptions',
                tone: 'text-amber-600',
              },
              {
                show: companiesWithoutDrivers.length > 0,
                text: `${companiesWithoutDrivers.length} empresa${companiesWithoutDrivers.length === 1 ? '' : 's'} activa${companiesWithoutDrivers.length === 1 ? '' : 's'} sin ningún conductor registrado`,
                href: '/super-admin/companies?status=active',
                tone: 'text-orange-500',
              },
              {
                show: cancellationRate30 > 0.15 && cancellationDenominator > 0,
                text: `Cancelaciones/no-show de la plataforma en ${(cancellationRate30 * 100).toFixed(1)}% (últimos 30 días) — arriba de lo saludable`,
                href: '/super-admin/dashboard',
                tone: 'text-red-500',
              },
            ]
              .filter((a) => a.show)
              .map((a, i) => (
                <Link key={i} href={a.href} className="flex items-center justify-between px-5 py-3 hover:bg-[#faf8f3] transition-colors">
                  <p className={`text-sm ${a.tone}`}>{a.text}</p>
                  <span className="text-xs text-[#75716a]">Revisar →</span>
                </Link>
              ))}
            {![suspended.length, trialsExpiringSoon.length, subsExpiringSoon.length, companiesWithoutDrivers.length].some((n) => n > 0) &&
              !(cancellationRate30 > 0.15 && cancellationDenominator > 0) && (
                <p className="px-5 py-6 text-sm text-[#75716a] text-center">Todo en orden — sin alertas activas.</p>
              )}
          </div>
        </section>

        {/* ── Empresas recientes ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">Empresas recientes</p>
            <Link href="/super-admin/companies" className="text-xs font-medium text-[#8a6520] hover:underline">Ver todas →</Link>
          </div>
          <div className={`${card} overflow-hidden`}>
            {companies.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#75716a]">Sin empresas todavía.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0ede5]">
                    {['Empresa', 'Estado', 'Plan', 'Ubicación', 'Ingresó'].map((h) => (
                      <th key={h} className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ede5]">
                  {companies.slice(0, 8).map((c) => (
                    <tr key={c.id} className="hover:bg-[#faf8f3] transition-colors">
                      <td className="px-6 py-3.5">
                        <Link href={`/super-admin/companies/${c.id}`} className="font-medium text-[#1d1b18] hover:text-[#8a6520] transition-colors">
                          {c.name}
                        </Link>
                        <p className="text-xs text-[#75716a] mt-0.5">/{c.slug}</p>
                      </td>
                      <td className="px-6 py-3.5"><StatusBadge status={c.status} /></td>
                      <td className="px-6 py-3.5 text-xs text-[#75716a] capitalize">{c.plan}</td>
                      <td className="px-6 py-3.5 text-xs text-[#75716a]">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-6 py-3.5 text-xs text-[#75716a]">
                        {new Date(c.created_at).toLocaleDateString('es-DO', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
