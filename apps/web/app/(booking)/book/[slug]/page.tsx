import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { fetchGoogleReviews } from '@/lib/reviews/google'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ReviewsCarousel } from '@/components/booking/reviews-carousel'
import { BookingWizard } from './booking-wizard'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }
const U = (slug: string) => `https://unsplash.com/photos/${slug}/download?force=true&w=1600`
const DEFAULT_HERO = U('9XVJ-Jq7Ke8')
const DEFAULT_CARS = [U('NjQmytqwDGs'), U('9XVJ-Jq7Ke8'), U('7I8qdKTHDp4'), U('4Dofvf-eUMs'), U('FZ5MkHkeyKM')]

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('name, city, logo_url, tagline')
    .eq('slug', params.slug)
    .single()
  if (!company) return { title: 'Reservación | LuxeRide' }

  const cityPart = company.city ? ` · ${company.city}` : ''
  const inCity = company.city ? ` en ${company.city}` : ''
  const title = `${company.name} — ${(company as { tagline?: string | null }).tagline || `Reserva tu traslado de lujo${cityPart}`}`
  const description = `Reserva en línea con ${company.name}: traslados al aeropuerto, chofer ejecutivo y transporte premium${inCity}. Cotización al instante, pago seguro y seguimiento en vivo.`
  const url = `${getAppUrl()}/${params.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, type: 'website', siteName: company.name, images: company.logo_url ? [{ url: company.logo_url }] : undefined },
  }
}

interface CompanyService {
  id: string
  title: string
  description: string | null
  icon: string | null
  image_url: string | null
}

export default async function OperatorMicrosite({ params }: Props) {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.microsite
  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, status, currency, primary_color, phone, email, city, logo_url, tagline, hero_image_url, about, stripe_connect_onboarded, settings')
    .eq('slug', params.slug)
    .single()
  if (!company || company.status !== 'active') return notFound()

  const placeId = ((company.settings as { site?: { googlePlaceId?: string } } | null)?.site)?.googlePlaceId
  const [{ data: vehicleTypes }, { data: servicesRaw }, googleReviews] = await Promise.all([
    admin.from('vehicle_types').select('id, name, class, capacity, amenities, base_image_url').eq('company_id', company.id).eq('is_active', true).order('sort_order'),
    admin.from('company_services').select('id, title, description, icon, image_url').eq('company_id', company.id).eq('is_active', true).order('sort_order'),
    fetchGoogleReviews(placeId, locale),
  ])

  const services = (servicesRaw ?? []) as CompanyService[]
  const fleet = vehicleTypes ?? []
  const brandColor = (company.primary_color as string | null) || '#c9a24b'
  const heroImg = (company as { hero_image_url?: string | null }).hero_image_url || DEFAULT_HERO
  const tagline = (company as { tagline?: string | null }).tagline ?? null
  const about = (company as { about?: string | null }).about ?? null
  const logoUrl = (company as { logo_url?: string | null }).logo_url ?? null
  const site = ((company.settings as { site?: { whatsapp?: string; googlePlaceId?: string } } | null)?.site) ?? {}
  const waNumber = (site.whatsapp ?? '').replace(/[^0-9]/g, '')

  const shortUrl = `${getAppUrl()}/${company.slug}`
  const qrDataUrl = await QRCode.toDataURL(shortUrl, { width: 200, margin: 1, color: { dark: '#0b0b0c', light: '#ffffff' } })

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': shortUrl,
    name: company.name, url: shortUrl, priceRange: '$$$',
    description: tagline || `${company.name} — servicio de transporte premium.`,
  }
  if (logoUrl) jsonLd.image = logoUrl
  if (company.phone) jsonLd.telephone = company.phone
  if (company.email) jsonLd.email = company.email
  if (company.city) jsonLd.areaServed = company.city
  if (services.length) jsonLd.makesOffer = services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.title, description: s.description ?? undefined } }))

  const sectionTitle = (title: string) => (
    <div className="text-center mb-14">
      <h2 className="font-playfair text-3xl sm:text-4xl font-semibold italic">{title}</h2>
      <div className="mx-auto mt-4 h-px w-20" style={{ backgroundColor: brandColor }} />
    </div>
  )

  return (
    <div className="bg-[#0b0b0c] text-white antialiased" style={{ ['--brand' as string]: brandColor }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0b0b0c]/80 backdrop-blur border-b border-white/5">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <a href="#top" className="flex items-baseline gap-2 min-w-0">
            <span className="font-playfair text-xl sm:text-2xl font-semibold tracking-[0.12em] truncate">{company.name}</span>
          </a>
          <nav className="flex items-center gap-5 sm:gap-7 text-[13px] text-white/70">
            {services.length > 0 && <a href="#servicios" className="hidden md:block hover:text-white transition-colors">{t.ourServices}</a>}
            {fleet.length > 0 && <a href="#flota" className="hidden md:block hover:text-white transition-colors">{t.ourFleet}</a>}
            <LanguageSwitcher current={locale} variant="dark" />
            <a href="#reservar" className="px-5 py-2 rounded-full text-[#0b0b0c] font-semibold text-xs" style={{ backgroundColor: brandColor }}>{t.bookNow}</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative isolate min-h-[86vh] flex items-center overflow-hidden">
        <Image src={heroImg} alt="" fill priority sizes="100vw" className="object-cover -z-10" />
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(90deg, rgba(11,11,12,0.94) 0%, rgba(11,11,12,0.6) 52%, rgba(11,11,12,0.25) 100%)' }} />
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 w-full">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.35em] mb-5" style={{ color: brandColor }}>{company.city || 'Premium transportation'}</p>
            <h1 className="font-playfair text-4xl sm:text-6xl font-semibold leading-[1.05] italic">
              {tagline || company.name}
            </h1>
            {about && <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-xl line-clamp-3">{about}</p>}
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#reservar" className="px-7 py-3.5 rounded-full text-[#0b0b0c] text-sm font-semibold transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="px-7 py-3.5 rounded-full text-sm font-semibold border border-white/30 hover:bg-white/10 transition-colors inline-flex items-center gap-2">
                  <span className="text-green-400">●</span> WhatsApp
                </a>
              )}
              {company.phone && (
                <a href={`tel:${company.phone}`} className="px-7 py-3.5 rounded-full text-sm font-semibold border border-white/30 hover:bg-white/10 transition-colors">{t.call}</a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Servicios alternados */}
      {services.length > 0 && (
        <section id="servicios" className="py-24 bg-[#0e0e10]">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {sectionTitle(t.ourServices)}
            <div className="space-y-16">
              {services.map((s, i) => (
                <div key={s.id} className="grid lg:grid-cols-2 gap-10 items-center">
                  <div className={`relative h-72 rounded-2xl overflow-hidden ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <Image src={s.image_url || DEFAULT_CARS[i % DEFAULT_CARS.length]} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
                  </div>
                  <div>
                    {s.icon && <span className="text-3xl">{s.icon}</span>}
                    <h3 className="font-playfair text-3xl font-semibold italic mb-4 mt-2">{s.title}</h3>
                    {s.description && <p className="text-white/60 leading-relaxed text-[15px]">{s.description}</p>}
                    <a href="#reservar" className="inline-block mt-6 text-sm font-semibold" style={{ color: brandColor }}>{t.bookNow} →</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* La diferencia */}
      <section className="relative isolate py-24 overflow-hidden">
        <Image src={heroImg} alt="" fill sizes="100vw" className="object-cover -z-10" />
        <div className="absolute inset-0 -z-10 bg-[#0b0b0c]/90" />
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-14 items-center">
          <div className="relative h-80 rounded-2xl overflow-hidden border border-white/10">
            <Image src={fleet[0]?.base_image_url || DEFAULT_CARS[0]} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </div>
          <div>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold italic mb-10">{t.whyTitle}</h2>
            <div className="space-y-7">
              {t.features.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <span className="h-10 w-10 shrink-0 rounded-full border flex items-center justify-center" style={{ borderColor: brandColor, color: brandColor }}>★</span>
                  <div>
                    <h3 className="font-playfair text-lg font-semibold">{f.title}</h3>
                    <p className="text-sm text-white/55 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Flota */}
      {fleet.length > 0 && (
        <section id="flota" className="py-24 bg-[#0e0e10]">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {sectionTitle(t.ourFleet)}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {fleet.map((v, i) => (
                <div key={v.id} className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02]">
                  <div className="relative h-52">
                    <Image src={v.base_image_url || DEFAULT_CARS[i % DEFAULT_CARS.length]} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover" />
                  </div>
                  <div className="p-6">
                    <h3 className="font-playfair text-xl font-semibold">{v.name}</h3>
                    <p className="text-sm text-white/50 mt-1">{v.capacity} {t.pax}</p>
                    {(v.amenities ?? []).length > 0 && <p className="text-xs text-white/35 mt-3">{(v.amenities ?? []).join(' · ')}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cómo reservar */}
      <section className="py-24 bg-[#0b0b0c]">
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
          {sectionTitle(t.stepsTitle)}
          <div className="grid sm:grid-cols-3 gap-6">
            {t.steps.map((st, i) => (
              <div key={st.title} className="relative isolate rounded-2xl overflow-hidden h-72 flex items-end">
                <Image src={DEFAULT_CARS[(i + 2) % DEFAULT_CARS.length]} alt="" fill sizes="(max-width:1024px) 100vw, 33vw" className="object-cover -z-10" />
                <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(rgba(11,11,12,0.2), rgba(11,11,12,0.94))' }} />
                <div className="p-6">
                  <p className="font-playfair text-3xl font-semibold" style={{ color: brandColor }}>{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="font-playfair text-xl font-semibold mt-2">{st.title}</h3>
                  <p className="text-sm text-white/60 mt-2 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reseñas de Google */}
      {googleReviews.reviews.length > 0 && (
        <ReviewsCarousel
          reviews={googleReviews.reviews}
          rating={googleReviews.rating}
          total={googleReviews.total}
          title={t.reviewsTitle}
          reviewsLabel={t.reviewsOnGoogle}
          brandColor={brandColor}
        />
      )}

      {/* Reservar + QR */}
      <section id="reservar" className="py-24 bg-[#0e0e10] border-t border-white/5 scroll-mt-16">
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-10 items-start">
          <div>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold italic mb-8">{t.bookTitle}</h2>
            <div className="bg-[#ebe7df] rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl shadow-black/40">
              <BookingWizard
                company={{ id: company.id, name: company.name, slug: company.slug, currency: (company.currency as string | null) ?? 'USD', primaryColor: brandColor, phone: (company.phone as string | null) ?? null, email: (company.email as string | null) ?? null }}
                vehicleTypes={fleet.map((vt) => ({ id: vt.id, name: vt.name, class: vt.class, capacity: vt.capacity, amenities: vt.amenities ?? [], imageUrl: vt.base_image_url ?? null }))}
                onlinePaymentsEnabled={isStripeConfigured() && Boolean(company.stripe_connect_onboarded)}
                dict={dict.wizard}
                localeTag={LOCALE_TAGS[locale] ?? 'en-US'}
                gratuity={(() => {
                  const g = (company.settings as { gratuity?: { enabled?: boolean; options?: number[]; default_percentage?: number }; booking?: { require_deposit?: boolean } } | null)?.gratuity
                  const requiresDeposit = Boolean((company.settings as { booking?: { require_deposit?: boolean } } | null)?.booking?.require_deposit)
                  return { enabled: (g?.enabled ?? true) && !requiresDeposit, options: g?.options ?? [15, 18, 20, 25], defaultPct: g?.default_percentage ?? 20 }
                })()}
              />
            </div>
          </div>
          <div className="lg:sticky lg:top-24 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR" className="w-40 h-40 mx-auto rounded-xl bg-white p-2" />
            <h3 className="mt-5 font-playfair text-lg font-semibold">{t.scanTitle}</h3>
            <p className="mt-1 text-sm text-white/50">{t.scanDesc}</p>
            {company.phone && (
              <a href={`tel:${company.phone}`} className="mt-5 inline-block text-sm font-semibold" style={{ color: brandColor }}>{t.call}: {company.phone}</a>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#080809] border-t border-white/5">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-16">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
            {/* Marca */}
            <div className="lg:col-span-5">
              <span className="font-playfair text-2xl font-semibold tracking-[0.14em]">{company.name}</span>
              {tagline && <p className="mt-4 text-sm text-white/45 max-w-sm leading-relaxed">{tagline}</p>}
              <div className="mt-6 flex items-center gap-3">
                {company.phone && (
                  <a href={`tel:${company.phone}`} aria-label={t.call} className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-sm hover:bg-white/10 transition-colors" style={{ color: brandColor }}>☎</a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} aria-label="Email" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-sm hover:bg-white/10 transition-colors" style={{ color: brandColor }}>✉</a>
                )}
                {waNumber && (
                  <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-sm hover:bg-white/10 transition-colors text-green-400">●</a>
                )}
              </div>
            </div>

            {/* Explora */}
            <div className="lg:col-span-3">
              <h4 className="text-[11px] uppercase tracking-[0.25em] text-white/40 mb-4">{t.footerExplore}</h4>
              <ul className="space-y-2.5 text-sm text-white/60">
                {services.length > 0 && <li><a href="#servicios" className="hover:text-white transition-colors">{t.ourServices}</a></li>}
                {fleet.length > 0 && <li><a href="#flota" className="hover:text-white transition-colors">{t.ourFleet}</a></li>}
                <li><a href="#reservar" className="hover:text-white transition-colors">{t.bookTitle}</a></li>
              </ul>
            </div>

            {/* Contacto */}
            <div className="lg:col-span-4">
              <h4 className="text-[11px] uppercase tracking-[0.25em] text-white/40 mb-4">{t.footerContact}</h4>
              <ul className="space-y-2.5 text-sm text-white/60">
                {company.phone && <li><a href={`tel:${company.phone}`} className="hover:text-white transition-colors">{company.phone}</a></li>}
                {company.email && <li><a href={`mailto:${company.email}`} className="hover:text-white transition-colors">{company.email}</a></li>}
                {waNumber && <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp</a></li>}
                {company.city && <li className="text-white/45">{company.city}</li>}
              </ul>
            </div>
          </div>

          {/* Barra inferior */}
          <div className="mt-14 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/35">© {new Date().getFullYear()} {company.name}. {t.rights}</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/30">Powered by {brand.name}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
