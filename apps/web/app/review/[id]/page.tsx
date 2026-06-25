import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { ReviewForm } from './review-form'

export const metadata: Metadata = {
  title: { absolute: 'Review' },
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const dict = getDict(getLocale())
  const t = dict.review

  const card =
    'w-full max-w-md rounded-2xl bg-white/[0.03] border border-white/10 p-7 sm:p-8 shadow-2xl shadow-black/40'
  const wrap = (children: React.ReactNode, brand = '#c9a24b') => (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#08080a] text-white antialiased" style={{ ['--brand' as string]: brand }}>
      {children}
    </div>
  )
  const heading = (title: string, body: string) => wrap(
    <div className={`${card} text-center space-y-3`}>
      <h1 className="font-playfair text-2xl font-medium">{title}</h1>
      <p className="text-sm text-white/55 leading-relaxed">{body}</p>
    </div>,
  )

  if (!UUID_RE.test(params.id)) return heading(t.notFoundTitle, t.notFoundBody)

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, status, rating, rated_at, company_id')
    .eq('id', params.id)
    .single()

  if (!booking) return heading(t.notFoundTitle, t.notFoundBody)

  const { data: company } = await admin
    .from('companies')
    .select('name, primary_color, logo_url')
    .eq('id', booking.company_id)
    .single()

  const companyName = company?.name ?? ''
  const brandColor = (company?.primary_color as string | null) || '#c9a24b'
  const logoUrl = (company?.logo_url as string | null) ?? null

  // Encabezado de marca (logo o inicial) reutilizado en form y agradecimiento.
  const brandHeader = (
    <div className="flex flex-col items-center gap-3 mb-6">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={companyName} className="h-11 max-w-[160px] object-contain" />
      ) : (
        <div className="h-11 w-11 rounded-xl flex items-center justify-center shadow-sm shadow-black/30" style={{ backgroundColor: brandColor }}>
          <span className="text-white font-playfair text-lg">{companyName.trim().charAt(0).toUpperCase() || 'L'}</span>
        </div>
      )}
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">{companyName}</p>
    </div>
  )

  if (booking.status !== 'completed') return heading(t.notCompletedTitle, t.notCompletedBody)

  // Ya calificado → agradecimiento con las estrellas dadas.
  if (booking.rated_at) {
    return wrap(
      <div className={`${card} text-center space-y-4`}>
        {brandHeader}
        <h1 className="font-playfair text-2xl font-medium">{t.thanksTitle}</h1>
        {booking.rating != null && (
          <p className="text-3xl tracking-[0.15em]" style={{ color: brandColor }}>
            {'★'.repeat(booking.rating)}<span className="text-white/15">{'★'.repeat(5 - booking.rating)}</span>
          </p>
        )}
        <p className="text-sm text-white/55 leading-relaxed">
          {t.thanksBody.replace('{company}', companyName)}
        </p>
      </div>,
      brandColor,
    )
  }

  return wrap(
    <div className={card}>
      <div className="text-center mb-7">
        {brandHeader}
        <span className="block h-px w-12 mx-auto mb-5" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />
        <h1 className="font-playfair text-2xl sm:text-[1.7rem] font-medium">{t.title}</h1>
        <p className="mt-2 text-sm text-white/55">{t.subtitle.replace('{company}', companyName)}</p>
        <p className="mt-3 text-[11px] uppercase tracking-widest text-white/35">
          {t.bookingLabel} · {booking.booking_number}
        </p>
      </div>
      <ReviewForm bookingId={booking.id} brandColor={brandColor} t={t} />
    </div>,
    brandColor,
  )
}
