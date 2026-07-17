import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.quotesList.title }
}

interface LocationJson { address?: string }

function shortAddress(loc: unknown): string {
  const a = (loc as LocationJson | null)?.address
  return a ? (a.split(',')[0] ?? a) : '—'
}

export default async function AdminQuotesPage() {
  const user = await requireRole('super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting')
  const t = getDict().admin.quotesList
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  if (!user.company_id) {
    return <div className="p-8"><p className="text-sm text-sl-on-surface-muted">{getDict().admin.bookingsList.noCompany}</p></div>
  }

  const admin = createAdminClient()
  const { data: quotes } = await admin
    .from('bookings')
    .select('id, booking_number, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, total_amount, currency, created_at')
    .eq('company_id', user.company_id)
    .eq('status', 'quote')
    .order('created_at', { ascending: false })
    .limit(100)

  const fmt = (iso: string) => new Date(iso).toLocaleString(localeTag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const ageDays = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  const ageLabel = (iso: string) => {
    const days = ageDays(iso)
    return days <= 0 ? t.today : `${days}d`
  }

  // Métricas del pipeline (sobre las cotizaciones abiertas cargadas)
  const list = quotes ?? []
  const potentialValue = list.reduce((sum, q) => sum + Number(q.total_amount ?? 0), 0)
  const staleCount = list.filter((q) => ageDays(q.created_at) > 3).length
  const metric = (label: string, value: string, warn = false) => (
    <div className="rounded-2xl bg-white border border-sl-outline-variant shadow-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{label}</p>
      <p className={`text-2xl font-playfair font-semibold mt-1 ${warn && staleCount > 0 ? 'text-amber-500' : 'text-sl-on-surface'}`}>{value}</p>
    </div>
  )

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">{t.subtitle.replace('{count}', String(quotes?.length ?? 0))}</p>
          <p className="text-xs text-sl-on-surface-muted/80 mt-1 max-w-xl">{t.hint}</p>
        </div>
        <Link href="/admin/bookings/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-gray-900 text-sm font-semibold rounded-xl hover:bg-gold/90 shadow-sm transition-colors whitespace-nowrap">
          <Plus size={16} strokeWidth={2.25} />
          {t.newQuote}
        </Link>
      </div>

      {/* Métricas del pipeline */}
      {list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {metric(t.metricOpen, String(list.length))}
          {metric(t.metricValue, `$${potentialValue.toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
          {metric(t.metricStale, String(staleCount), true)}
        </div>
      )}

      {!quotes?.length ? (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">{t.empty}</p>
        </div>
      ) : (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20">
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colNumber}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colPassenger}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colScheduled}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colRoute}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colTotal}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colAge}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-sl-bg/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/bookings/${q.id}`} className="font-mono text-xs text-bronze hover:underline">{q.booking_number}</Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-sl-on-surface">{q.passenger_name ?? '—'}</p>
                    {q.passenger_phone && <p className="text-[11px] text-sl-on-surface-muted">{q.passenger_phone}</p>}
                  </td>
                  <td className="px-6 py-4 text-sl-on-surface-muted whitespace-nowrap">{fmt(q.scheduled_at)}</td>
                  <td className="px-6 py-4 text-sl-on-surface max-w-[260px] truncate">
                    {shortAddress(q.pickup_location)} → {shortAddress(q.dropoff_location)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-sl-on-surface">
                    {q.total_amount != null ? `$${Number(q.total_amount).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right text-sl-on-surface-muted">{ageLabel(q.created_at)}</td>
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
