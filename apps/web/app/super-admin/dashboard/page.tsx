import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { InfoTip } from '@/components/ui/info-tip'
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
    { data: vehicleCompanyRows },
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
    admin.from('drivers').select('company_id, is_available'),
    admin.from('vehicles').select('company_id'),
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

  // ── E. Flota y conductores (plataforma + detalle por empresa) ──────────────
  const driverCountByCompany = new Map<string, number>()
  const availableDriverCountByCompany = new Map<string, number>()
  for (const d of driverCompanyRows ?? []) {
    driverCountByCompany.set(d.company_id, (driverCountByCompany.get(d.company_id) ?? 0) + 1)
    if (d.is_available) availableDriverCountByCompany.set(d.company_id, (availableDriverCountByCompany.get(d.company_id) ?? 0) + 1)
  }
  const vehicleCountByCompany = new Map<string, number>()
  for (const v of vehicleCompanyRows ?? []) {
    vehicleCountByCompany.set(v.company_id, (vehicleCountByCompany.get(v.company_id) ?? 0) + 1)
  }
  const companiesWithDrivers = new Set(driverCountByCompany.keys())
  const companiesWithoutDrivers = active.filter((c) => !companiesWithDrivers.has(c.id))
  const fleetByCompany = [...active, ...trial]
    .map((c) => ({
      company: c,
      drivers: driverCountByCompany.get(c.id) ?? 0,
      available: availableDriverCountByCompany.get(c.id) ?? 0,
      vehicles: vehicleCountByCompany.get(c.id) ?? 0,
    }))
    .sort((a, b) => a.drivers - b.drivers)

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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520] flex items-center">
                MRR
                <InfoTip text="Ingreso Mensual Recurrente: suma del precio mensual del plan de cada empresa con estado ACTIVA (pagando) ahora mismo. Se recalcula solo si cambias el precio de un plan o si una empresa cambia de plan/estado." />
              </p>
              <p className="text-4xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(mrr)}</p>
              <p className="text-[11px] text-[#75716a] mt-0.5">{active.length} empresa{active.length === 1 ? '' : 's'} activa{active.length === 1 ? '' : 's'} pagando</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                ARPU
                <InfoTip text="Ingreso promedio por empresa activa: MRR dividido entre el número de empresas activas. Sube si cambian de un plan barato a uno caro, o baja si entran muchas empresas nuevas en planes económicos." />
              </p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(arpu)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center w-full">
                Por plan
                <InfoTip text="Cuántas empresas ACTIVAS (pagando) hay en cada plan pagado. No incluye Free ni empresas en prueba/suspendidas/canceladas." />
              </p>
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
              { label: 'Total empresas', value: companies.length, href: '/super-admin/companies', tip: 'Todas las empresas registradas en LuxeRide, sin importar su estado (activa, prueba, suspendida o cancelada).' },
              { label: 'Activas',        value: active.length,    href: '/super-admin/companies?status=active', tip: 'Empresas con estado ACTIVA — son las que pagan y cuentan para el MRR.' },
              { label: 'En prueba',      value: trial.length,     href: '/super-admin/subscriptions', tip: 'Empresas que se registraron desde el landing y aún no han sido aprobadas/activadas — todavía no pagan.' },
              { label: 'Suspendidas',    value: suspended.length, href: '/super-admin/companies?status=suspended', accent: suspended.length > 0, tip: 'Empresas a las que les cerraste el acceso manualmente (ej. por falta de pago). No pueden operar hasta reactivarlas.' },
              { label: 'Nuevas (7 d)',   value: newThisWeek,      href: '/super-admin/companies', tip: 'Empresas creadas (cualquier estado) en los últimos 7 días — mide el ritmo de altas nuevas.' },
              { label: 'Nuevas (mes)',   value: newThisMonth,     href: '/super-admin/companies', tip: 'Empresas creadas (cualquier estado) desde el día 1 del mes calendario actual.' },
            ].map((k) => (
              <Link
                key={k.label}
                href={k.href}
                className={`${card} px-4 py-3.5 hover:border-[#8a6520]/50 transition-colors group`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                  {k.label}
                  <InfoTip text={k.tip} />
                </p>
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520] flex items-center">
                GMV este mes
                <InfoTip text="Gross Merchandise Value: suma del monto total de TODAS las reservas COMPLETADAS de TODAS las empresas, desde el día 1 del mes calendario actual. No es ingreso de LuxeRide — es el volumen de negocio que procesan tus operadores." />
              </p>
              <p className="text-4xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(gmvMonth)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                GMV hoy
                <InfoTip text="Suma del monto de reservas completadas HOY, en todas las empresas." />
              </p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(gmvToday)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                GMV histórico
                <InfoTip text="Suma de TODAS las reservas completadas desde siempre, en todas las empresas (hasta las últimas 10,000 reservas más recientes)." />
              </p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(gmvAllTime)}</p>
            </div>
            <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                Valor promedio
                <InfoTip text="GMV histórico dividido entre el número de reservas completadas — el ticket promedio de un viaje en toda la plataforma." />
              </p>
              <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">{money(avgBookingValue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Reservas totales', value: totalBookingsAllTime ?? 0, tip: 'Cuenta de TODAS las reservas creadas en la plataforma, en cualquier estado (pendiente, cancelada, completada, etc.), desde siempre.' },
              { label: 'En curso ahora',   value: activeBookingsCount ?? 0, tip: 'Reservas ahora mismo en estado pendiente, asignada, en ruta, en el pickup o en viaje — el volumen operativo "en vivo" de toda la plataforma.' },
              { label: 'Completadas (30 d)', value: completedCount30, tip: 'Reservas que llegaron a estado COMPLETADA en los últimos 30 días, en todas las empresas.' },
              { label: 'Cancel./no-show (30 d)', value: `${(cancellationRate30 * 100).toFixed(1)}%`, accent: cancellationRate30 > 0.15, tip: 'De las reservas que terminaron (completadas + canceladas + no-show) en los últimos 30 días, qué porcentaje NO se completó. Arriba de 15% se resalta en rojo como señal de calidad de servicio a vigilar.' },
            ].map((k) => (
              <div key={k.label} className={`${card} px-4 py-3.5`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                  {k.label}
                  <InfoTip text={k.tip} />
                </p>
                <p className={`text-2xl font-playfair font-semibold mt-1 ${'accent' in k && k.accent ? 'text-red-500' : 'text-[#1d1b18]'}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className={`${card} p-6`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] mb-4 flex items-center">
              Reservas completadas — últimos {TREND_DAYS} días
              <InfoTip text="Cada barra es un día: cuántas reservas se completaron ese día en toda la plataforma (todas las empresas juntas). Pasa el mouse sobre una barra para ver el GMV de ese día." />
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
                    {[
                      { label: 'Empresa' },
                      { label: 'Plan' },
                      { label: 'Reservas', tip: 'Reservas completadas de esta empresa en el mes calendario actual.' },
                      { label: 'GMV', tip: 'Suma del monto de las reservas completadas de esta empresa, en el mes calendario actual.' },
                    ].map((h) => (
                      <th key={h.label} className="text-left px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
                        <span className="inline-flex items-center">{h.label}{h.tip && <InfoTip text={h.tip} />}</span>
                      </th>
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                Volumen exitoso
                <InfoTip text="Suma de los pagos con Stripe que se cobraron con éxito en los últimos 30 días, en todas las empresas. No incluye pagos en efectivo/Zelle/transferencia (esos no pasan por Stripe)." />
              </p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18]">{money(succeededVolume)}</p>
            </div>
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                Pagos fallidos
                <InfoTip text="Intentos de cobro con Stripe que fallaron (tarjeta rechazada, fondos insuficientes, etc.) en los últimos 30 días. Arriba de 10% se resalta en rojo." />
              </p>
              <p className={`text-2xl font-playfair font-semibold mt-1 ${failureRate > 0.1 ? 'text-red-500' : 'text-[#1d1b18]'}`}>
                {failedPayments.length} <span className="text-sm font-normal text-[#75716a]">({(failureRate * 100).toFixed(1)}%)</span>
              </p>
            </div>
            <div className={`${card} px-4 py-3.5 col-span-2`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] mb-1.5 flex items-center">
                Método de pago (exitosos)
                <InfoTip text="Cómo pagaron los pasajeros en los pagos exitosos de los últimos 30 días: tarjeta (Stripe), efectivo, cuenta corporativa o transferencia bancaria." />
              </p>
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                Conductores totales
                <InfoTip text="Cuántos conductores tienen ficha registrada (tabla drivers) en cualquier empresa de la plataforma, sin importar si están en servicio ahora mismo." />
              </p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18]">{totalDrivers ?? 0}</p>
            </div>
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                En servicio ahora
                <InfoTip text="Conductores marcados como disponibles ('en servicio') en este momento, en toda la plataforma — el conductor controla esto desde su propio portal." />
              </p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-green-600">{availableDriversNow ?? 0}</p>
            </div>
            <div className={`${card} px-4 py-3.5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                Vehículos totales
                <InfoTip text="Cuántos vehículos tienen ficha registrada (tabla vehicles) en cualquier empresa de la plataforma." />
              </p>
              <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18]">{totalVehicles ?? 0}</p>
            </div>
          </div>

          <div className={`${card} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-[#f0ede5]">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
                Flota por empresa
                <InfoTip text="Detalle de conductores y vehículos registrados en cada empresa activa o en prueba, ordenado de menos a más conductores — así las que están en riesgo (0 o pocos conductores) aparecen primero." />
              </p>
            </div>
            {fleetByCompany.length === 0 ? (
              <p className="p-6 text-sm text-[#75716a] text-center">Sin empresas activas o en prueba todavía.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0ede5]">
                    {[
                      { label: 'Empresa' },
                      { label: 'Estado' },
                      { label: 'Conductores', tip: 'Total de conductores con ficha registrada en esta empresa (tabla drivers), sin importar si están en servicio.' },
                      { label: 'En servicio', tip: 'De esos conductores, cuántos están marcados como disponibles ahora mismo.' },
                      { label: 'Vehículos', tip: 'Total de vehículos con ficha registrada en esta empresa (tabla vehicles).' },
                    ].map((h) => (
                      <th key={h.label} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
                        <span className="inline-flex items-center">{h.label}{h.tip && <InfoTip text={h.tip} />}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ede5]">
                  {fleetByCompany.map((r) => (
                    <tr key={r.company.id} className="hover:bg-[#faf8f3] transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/super-admin/companies/${r.company.id}`} className="font-medium text-[#1d1b18] hover:text-[#8a6520] transition-colors">
                          {r.company.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={r.company.status} /></td>
                      <td className={`px-5 py-3 text-sm font-medium ${r.drivers === 0 ? 'text-red-500' : 'text-[#1d1b18]'}`}>{r.drivers}</td>
                      <td className="px-5 py-3 text-sm text-green-600">{r.available}</td>
                      <td className="px-5 py-3 text-sm text-[#1d1b18]">{r.vehicles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── F. Alertas y vigilancia ── */}
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520] flex items-center">
            Alertas y vigilancia
            <InfoTip text="Cosas que probablemente quieras revisar: empresas suspendidas, pruebas o suscripciones que vencen en 7 días o menos, empresas activas sin ningún conductor cargado, y cancelación/no-show por encima de 15% en los últimos 30 días. Cada alerta enlaza a la página donde puedes actuar." />
          </p>
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
