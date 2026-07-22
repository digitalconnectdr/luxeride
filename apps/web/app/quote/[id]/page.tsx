import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { QuoteActions } from './quote-actions'

export const metadata: Metadata = {
  title: { absolute: 'Quote' },
  robots: { index: false, follow: false },
}

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function addr(loc: unknown): string {
  return (loc as { address?: string } | null)?.address ?? '—'
}

export default async function QuotePage({ params }: { params: { id: string } }) {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.quoteAccept
  const localeTag = LOCALE_TAGS[locale] ?? 'en-US'

  const card = 'w-full max-w-md rounded-2xl bg-white/[0.03] border border-white/10 p-7 sm:p-8 shadow-2xl shadow-black/40'
  const wrap = (children: React.ReactNode, brand = '#c9a24b') => (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#08080a] text-white antialiased" style={{ ['--brand' as string]: brand }}>
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher current={locale} variant="dark" />
      </div>
      {children}
    </div>
  )
  const heading = (title: string, body: string, brand = '#c9a24b', header?: React.ReactNode) => wrap(
    <div className={`${card} text-center space-y-3`}>
      {header}
      <h1 className="font-playfair text-2xl font-medium">{title}</h1>
      <p className="text-sm text-white/55 leading-relaxed">{body}</p>
    </div>,
    brand,
  )

  if (!UUID_RE.test(params.id)) return heading(t.notFoundTitle, t.notFoundBody)

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, status, scheduled_at, pickup_location, dropoff_location, total_amount, currency, company_id, vehicle_type_id')
    .eq('id', params.id)
    .single()

  if (!booking) return heading(t.notFoundTitle, t.notFoundBody)

  const [{ data: company }, { data: vt }] = await Promise.all([
    admin.from('companies').select('name, primary_color, logo_url').eq('id', booking.company_id).single(),
    booking.vehicle_type_id
      ? admin.from('vehicle_types').select('name').eq('id', booking.vehicle_type_id).single()
      : Promise.resolve({ data: null }),
  ])

  const companyName = company?.name ?? ''
  const brandColor = (company?.primary_color as string | null) || '#c9a24b'
  const logoUrl = (company?.logo_url as string | null) ?? null

  const brandHeader = (
    <div className="flex flex-col items-center gap-3 mb-6">
      {logoUrl ? (
        <div className="h-12 w-12 rounded-xl bg-white p-1.5 shadow-sm shadow-black/30 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={companyName} className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <div className="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm shadow-black/30" style={{ backgroundColor: brandColor }}>
          <span className="text-[#08080a] font-bold text-lg leading-none">{companyName.trim().charAt(0).toUpperCase() || 'L'}</span>
        </div>
      )}
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">{companyName}</p>
    </div>
  )

  // Estados ya resueltos
  if (booking.status !== 'quote') {
    const active = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed'].includes(booking.status)
    if (active) return heading(t.acceptedTitle, t.acceptedBody, brandColor, brandHeader)
    if (booking.status === 'cancelled') return heading(t.declinedTitle, t.declinedBody, brandColor, brandHeader)
    return heading(t.unavailableTitle, t.unavailableBody, brandColor, brandHeader)
  }

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 py-2 border-b border-white/[0.06] last:border-0">
      <span className="text-xs uppercase tracking-widest text-white/40 shrink-0">{label}</span>
      <span className="text-sm text-white/85 text-right">{value}</span>
    </div>
  )

  return wrap(
    <div className={card}>
      <div className="text-center mb-6">
        {brandHeader}
        <span className="block h-px w-12 mx-auto mb-5" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />
        <h1 className="font-playfair text-2xl sm:text-[1.7rem] font-medium">{t.title}</h1>
        <p className="mt-2 text-sm text-white/55">{t.subtitle.replace('{company}', companyName)}</p>
        <p className="mt-3 text-[11px] uppercase tracking-widest text-white/35">{t.quoteLabel} · {booking.booking_number}</p>
      </div>

      <div className="mb-6">
        {row(t.dateTime, new Date(booking.scheduled_at).toLocaleString(localeTag, { dateStyle: 'medium', timeStyle: 'short' }))}
        {row(t.pickup, addr(booking.pickup_location))}
        {row(t.dropoff, addr(booking.dropoff_location))}
        {vt?.name && row(t.vehicle, vt.name)}
        <div className="flex justify-between items-baseline gap-4 pt-3 mt-1">
          <span className="text-sm font-semibold text-white">{t.total}</span>
          <span className="font-playfair text-2xl font-semibold" style={{ color: brandColor }}>
            {booking.total_amount != null ? `$${Number(booking.total_amount).toFixed(2)}` : '—'} <span className="text-xs font-sans text-white/40">{booking.currency ?? 'USD'}</span>
          </span>
        </div>
      </div>

      <QuoteActions bookingId={booking.id} brandColor={brandColor} t={t} />
    </div>,
    brandColor,
  )
}
