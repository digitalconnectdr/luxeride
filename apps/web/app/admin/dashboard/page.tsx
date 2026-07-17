import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  CalendarDays,
  Car,
  CheckCircle,
  Users,
  Clock,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { brand } from '@/lib/brand'
import { gatherOnboardingCounts } from '@/lib/onboarding/gather'
import { computeOnboardingChecklist, getOnboardingProgress, type OnboardingItem } from '@/lib/onboarding/checklist'

export const metadata: Metadata = { title: `Dashboard | ${brand.name}` }

export default async function AdminDashboardPage() {
  const user = await requireRole(
    'super_admin',
    'company_owner',
    'company_admin',
    'dispatcher',
    'accounting'
  )

  const companyId = user.company_id
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.adminDashboard
  const onboardingT = dict.admin.onboarding
  const dateLocale = LOCALE_BCP47[locale]
  const isOwnerOrAdmin = user.role === 'company_owner' || user.role === 'company_admin'

  // Fetch fleet + driver + booking stats
  let stats = { vehicles: 0, driversAvail: 0, fleet: 0 }
  let bookingStats = { pending: 0, active: 0, today: 0, completedMonth: 0 }
  let revenue = { month: 0, today: 0 }
  let recentBookings: { id: string; booking_number: string; status: string; passenger_name: string | null; scheduled_at: string; total_amount: number | null }[] = []
  let upcomingBookings: { id: string; booking_number: string; status: string; passenger_name: string | null; scheduled_at: string }[] = []
  let weekTrend: { day: string; count: number }[] = []
  let onboardingItems: OnboardingItem[] = []
  let onboardingProgress = { completed: 0, total: 0 }

  if (companyId) {
    const admin = createAdminClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const next24h = new Date(Date.now() + 24 * 3_600_000)
    // Semana actual con inicio en DOMINGO (getDay(): 0=Dom … 6=Sáb)
    const weekStart = new Date(todayStart)
    weekStart.setDate(todayStart.getDate() - todayStart.getDay())

    const activeStatuses = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress'] as const

    // Counts vía head:true — no se transfieren filas, solo el conteo.
    // Las únicas filas que viajan están acotadas (mes actual / 7 días / top N).
    const [
      { count: vehiclesCount },
      { count: vehiclesAvailCount },
      { count: driversAvailCount },
      { count: pendingCount },
      { count: activeCount },
      { count: todayCount },
      { data: completedMonth },
      { data: weekRows },
      { data: recent },
      { data: upcoming },
    ] = await Promise.all([
      admin.from('vehicles').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      admin.from('vehicles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'available'),
      admin.from('drivers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_available', true),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pending'),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', activeStatuses),
      admin.from('bookings').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('scheduled_at', todayStart.toISOString()),
      admin
        .from('bookings')
        .select('total_amount, completed_at')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('completed_at', monthStart.toISOString()),
      admin
        .from('bookings')
        .select('created_at')
        .eq('company_id', companyId)
        .gte('created_at', weekStart.toISOString()),
      admin
        .from('bookings')
        .select('id, booking_number, status, passenger_name, scheduled_at, total_amount')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5),
      admin
        .from('bookings')
        .select('id, booking_number, status, passenger_name, scheduled_at')
        .eq('company_id', companyId)
        .in('status', ['pending', 'assigned', 'en_route', 'arrived'])
        .gte('scheduled_at', new Date().toISOString())
        .lte('scheduled_at', next24h.toISOString())
        .order('scheduled_at')
        .limit(6),
    ])

    stats = {
      vehicles:     vehiclesCount ?? 0,
      driversAvail: driversAvailCount ?? 0,
      fleet:        vehiclesAvailCount ?? 0,
    }

    bookingStats = {
      pending:        pendingCount ?? 0,
      active:         activeCount ?? 0,
      today:          todayCount ?? 0,
      completedMonth: completedMonth?.length ?? 0,
    }

    revenue = {
      month: (completedMonth ?? []).reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
      today: (completedMonth ?? [])
        .filter((b) => b.completed_at && new Date(b.completed_at) >= todayStart)
        .reduce((s, b) => s + Number(b.total_amount ?? 0), 0),
    }

    // Tendencia: reservaciones creadas por día de la semana actual (Dom→Sáb).
    // El índice i ES el día de la semana, así que el orden y las etiquetas
    // (localizadas) siempre arrancan en domingo.
    weekTrend = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(weekStart.getTime() + i * 24 * 3_600_000)
      const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000)
      return {
        day: t.dayLabels[i],
        count: (weekRows ?? []).filter((b) => {
          const created = new Date(b.created_at)
          return created >= dayStart && created < dayEnd
        }).length,
      }
    })

    recentBookings = recent ?? []
    upcomingBookings = upcoming ?? []

    const onboardingCounts = await gatherOnboardingCounts(admin, companyId)
    onboardingItems = computeOnboardingChecklist(onboardingCounts)
    onboardingProgress = getOnboardingProgress(onboardingItems)
  }

  const STATUS_COLORS: Record<string, string> = {
    pending:     'bg-yellow-100 text-yellow-700',
    assigned:    'bg-blue-100 text-blue-700',
    en_route:    'bg-indigo-100 text-indigo-700',
    arrived:     'bg-purple-100 text-purple-700',
    in_progress: 'bg-orange-100 text-orange-700',
    completed:   'bg-green-100 text-green-700',
    cancelled:   'bg-red-100 text-red-600',
    no_show:     'bg-red-100 text-red-600',
  }
  const STATUS_LABELS: Record<string, string> = t.statuses

  // ── Diseño "Ivory": claro refinado, acento bronce #8a6520 (legible sobre
  // fondo claro, reemplaza al dorado #e9c176 que no contrastaba), tarjetas
  // blancas con borde fino, ancho completo y KPIs compactos en una fila.
  return (
    <div className="min-h-full bg-[#f6f4ef] p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-[#1d1b18] tracking-tight">{t.title}</h1>
          <p className="text-sm text-[#75716a] mt-2">
            {t.welcome}, {user.profile.first_name} |{' '}
            <span className="text-[#8a6520] font-medium capitalize">{user.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#e5e1d8] px-4 py-2 shadow-sm">
          <CalendarDays size={14} className="text-[#8a6520] shrink-0" />
          <span className="text-xs font-medium text-[#1d1b18] capitalize">
            {new Date().toLocaleDateString(dateLocale, {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Onboarding — checklist de setup, visible mientras falte algo por configurar */}
      {companyId && isOwnerOrAdmin && onboardingProgress.completed < onboardingProgress.total && (
        <div className="bg-white border border-[#e5e1d8] rounded-xl px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="font-playfair text-lg font-semibold text-[#1d1b18]">{onboardingT.title}</h2>
            <p className="text-xs font-semibold text-[#8a6520]">
              {onboardingT.progress
                .replace('{completed}', String(onboardingProgress.completed))
                .replace('{total}', String(onboardingProgress.total))}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {onboardingItems.map((item) => {
              const label = onboardingT[item.key]
              return item.done ? (
                <div
                  key={item.key}
                  className="flex items-center gap-2.5 text-xs text-[#1d1b18] px-4 py-3 rounded-xl bg-white border border-[#e5e1d8]"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" strokeWidth={2} />
                  <span>{label}</span>
                </div>
              ) : (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-2.5 text-xs font-medium text-[#1d1b18] px-4 py-3 rounded-xl border-2 border-[#8a6520]/40 hover:border-[#8a6520] hover:bg-[#8a6520]/[0.04] transition-colors"
                >
                  <Circle className="w-4 h-4 text-[#8a6520] shrink-0" strokeWidth={2} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* KPIs — fila compacta de 6 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: t.kpis.vehicles,  value: stats.vehicles,       href: '/admin/fleet', icon: Car },
          { label: t.kpis.available, value: stats.fleet,          href: '/admin/fleet', icon: CheckCircle },
          { label: t.kpis.drivers,   value: stats.driversAvail,   href: '/admin/drivers', icon: Users },
          { label: t.kpis.pending,   value: bookingStats.pending, href: '/admin/bookings?status=pending', icon: Clock },
          { label: t.kpis.active,    value: bookingStats.active,  href: '/admin/bookings', icon: ShieldCheck },
          { label: t.kpis.today,     value: bookingStats.today,   href: '/admin/bookings', icon: CalendarDays },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white border border-[#e5e1d8] rounded-2xl px-4 py-4 shadow-sm hover:shadow-md hover:border-[#8a6520]/50 transition-all group"
          >
            <card.icon size={16} className="mb-2 text-[#75716a]" strokeWidth={1.75} />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
              {card.label}
            </p>
            <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18] transition-colors group-hover:text-[#8a6520]">
              {companyId ? card.value : '—'}
            </p>
          </Link>
        ))}
      </div>

      {/* Ingresos — el centro visual financiero del panel: cuadro de acento oscuro
          + cifras sobre fondo claro (no toda la tarjeta en negro). */}
      <div className="bg-white border border-[#e5e1d8] rounded-2xl shadow-sm overflow-hidden flex items-stretch">
        <div className="w-[96px] sm:w-[130px] shrink-0 bg-[#1d1b18] flex items-center justify-center">
          <TrendingUp size={26} className="text-gold" strokeWidth={1.75} />
        </div>
        <div className="flex-1 flex flex-wrap items-center gap-x-10 gap-y-4 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520]">
              {t.revenueMonth}
            </p>
            <p className="text-4xl sm:text-5xl font-playfair font-semibold text-[#8a6520] mt-1">
              ${revenue.month.toFixed(2)}
            </p>
          </div>
          <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
              {t.revenueToday}
            </p>
            <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">
              ${revenue.today.toFixed(2)}
            </p>
          </div>
          <div className="h-10 w-px bg-[#e5e1d8] hidden sm:block" />
          <Link href="/admin/bookings?status=completed" className="group">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
              {t.completedMonth}
            </p>
            <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1 group-hover:text-[#8a6520] transition-colors">
              {companyId ? bookingStats.completedMonth : '—'}
            </p>
          </Link>
        </div>
      </div>

      {/* Tendencia 7 días + Próximos viajes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tendencia — gráfica de línea con puntos, alimentada con datos reales */}
        <div className="bg-white border border-[#e5e1d8] rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
              {t.trendWeek}
            </p>
            <div className="w-7 h-7 rounded-lg bg-[#f6f4ef] flex items-center justify-center shrink-0">
              <CalendarDays size={14} className="text-[#8a6520]" strokeWidth={1.75} />
            </div>
          </div>
          {(() => {
            const max = Math.max(1, ...weekTrend.map((d) => d.count))
            const chartW = 320
            const chartH = 96
            const stepX = weekTrend.length > 1 ? chartW / (weekTrend.length - 1) : 0
            const points = weekTrend.map((d, i) => ({
              x: i * stepX,
              y: chartH - (d.count / max) * chartH,
              count: d.count,
            }))
            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
            return (
              <div className="flex gap-3">
                <div className="flex flex-col justify-between text-[10px] text-[#75716a] py-0.5" style={{ height: chartH }}>
                  <span>{max}</span>
                  <span>{Math.round(max / 2)}</span>
                  <span>0</span>
                </div>
                <div className="flex-1 min-w-0">
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: chartH }} preserveAspectRatio="none">
                    <line x1="0" y1="0" x2={chartW} y2="0" stroke="#e5e1d8" strokeWidth="1" />
                    <line x1="0" y1={chartH / 2} x2={chartW} y2={chartH / 2} stroke="#e5e1d8" strokeWidth="1" />
                    <line x1="0" y1={chartH} x2={chartW} y2={chartH} stroke="#e5e1d8" strokeWidth="1" />
                    <path d={pathD} fill="none" stroke="#8a6520" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="3" fill="#8a6520" />
                    ))}
                  </svg>
                  <div className="flex justify-between mt-1.5">
                    {weekTrend.map((d, i) => (
                      <span key={i} className="text-[10px] text-[#75716a]">{d.day}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Próximos viajes */}
        <div className="bg-white border border-[#e5e1d8] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f0ede5]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
              {t.next24h}
            </p>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="py-10 px-6 flex flex-col items-center gap-3 text-center">
              <div className="w-11 h-11 rounded-full bg-[#f6f4ef] flex items-center justify-center">
                <CalendarDays size={18} className="text-[#75716a]" strokeWidth={1.75} />
              </div>
              <p className="text-sm text-[#75716a]">
                {t.noUpcoming}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0ede5]">
              {upcomingBookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-[#faf8f3] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-[#8a6520] shrink-0">{b.booking_number}</span>
                    <span className="text-xs text-[#75716a] truncate">{b.passenger_name ?? '—'}</span>
                  </div>
                  <span className="text-xs font-medium text-[#1d1b18] shrink-0">
                    {new Date(b.scheduled_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reservaciones recientes */}
      <div className="bg-white border border-[#e5e1d8] rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0ede5]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a]">
            {t.recent}
          </p>
          <Link href="/admin/bookings" className="text-xs font-medium text-[#8a6520] hover:underline">
            {t.viewAll}
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[#75716a]">{t.noBookings}</p>
            <Link
              href="/admin/bookings/new"
              className="mt-2 inline-block text-sm font-medium text-[#8a6520] hover:underline"
            >
              {t.createFirst}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0ede5]">
                  <th className="text-left font-semibold text-[10px] uppercase tracking-widest text-[#75716a] px-6 py-2.5">
                    {t.recent}
                  </th>
                  <th className="text-left font-semibold text-[10px] uppercase tracking-widest text-[#75716a] px-3 py-2.5">
                    {t.statusLabel}
                  </th>
                  <th className="text-left font-semibold text-[10px] uppercase tracking-widest text-[#75716a] px-3 py-2.5">
                    {t.passengerLabel}
                  </th>
                  <th className="text-right font-semibold text-[10px] uppercase tracking-widest text-[#75716a] px-3 py-2.5">
                    {t.amountLabel}
                  </th>
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ede5]">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="group hover:bg-[#faf8f3] transition-colors">
                    <td className="px-6 py-3">
                      <Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs text-[#8a6520]">
                        {b.booking_number}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#75716a]">{b.passenger_name ?? '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-[#1d1b18]">
                      {b.total_amount != null ? `$${Number(b.total_amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/bookings/${b.id}`} className="flex justify-end text-[#75716a] group-hover:text-[#8a6520] transition-colors">
                        <ChevronRight size={16} strokeWidth={1.75} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>
    </div>
  )
}
