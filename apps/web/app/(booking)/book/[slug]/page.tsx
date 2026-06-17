import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { fetchGoogleReviews } from '@/lib/reviews/google'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ReviewsCarousel } from '@/components/booking/reviews-carousel'
import { Reveal } from '@/components/landing/reveal'
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
  const reservarUrl = `/book/${company.slug}/reservar`

  const shortUrl = `${getAppUrl()}/${company.slug}`
  const qrDataUrl = await QRCode.toDataURL(shortUrl, { width: 220, margin: 1, color: { dark: '#0a0a0c', light: '#ffffff' } })

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

  // Encabezado de sección refinado: regla dorada + título serif vertical.
  const sectionHeading = (title: string) => (
    <Reveal className="mb-16 flex flex-col items-center text-center">
      <span className="h-px w-12" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />
      <h2 className="mt-6 font-playfair text-[2rem] sm:text-4xl lg:text-[2.75rem] font-medium tracking-[-0.01em] text-balance">{title}</h2>
    </Reveal>
  )

  return (
    <div className="bg-[#08080a] text-white antialiased selection:bg-[var(--brand)]/30" style={{ ['--brand' as string]: brandColor }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#08080a]/85 backdrop-blur-md border-b border-white/[0.06]">
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}55, transparent)` }} />
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
          <a href="#top" className="flex items-baseline gap-2 min-w-0">
            <span className="font-playfair text-xl sm:text-[1.6rem] font-medium tracking-[0.04em] truncate">{company.name}</span>
          </a>
          <nav className="flex items-center gap-6 sm:gap-8 text-[13px] text-white/65">
            {services.length > 0 && <a href="#servicios" className="hidden md:inline-block lux-link hover:text-white transition-colors">{t.ourServices}</a>}
            {fleet.length > 0 && <a href="#flota" className="hidden md:inline-block lux-link hover:text-white transition-colors">{t.ourFleet}</a>}
            <LanguageSwitcher current={locale} variant="dark" />
            <a href={reservarUrl} className="px-5 py-2 rounded-full text-[#08080a] font-semibold text-xs tracking-wide transition-transform hover:scale-[1.04]" style={{ backgroundColor: brandColor }}>{t.bookNow}</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="lux-grain relative isolate min-h-[92vh] flex items-center overflow-hidden">
        <Image src={heroImg} alt="" fill priority sizes="100vw" className="object-cover -z-10 animate-kenburns" />
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(100deg, rgba(8,8,10,0.95) 0%, rgba(8,8,10,0.72) 46%, rgba(8,8,10,0.3) 100%)' }} />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#08080a] to-transparent" />
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 w-full">
          <Reveal className="max-w-2xl">
            <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.4em] text-white/70 mb-7">
              <span className="h-px w-8" style={{ backgroundColor: brandColor }} />
              {company.city || 'Premium chauffeur service'}
            </p>
            <h1 className="font-playfair text-[2.6rem] sm:text-6xl lg:text-[4.25rem] font-medium leading-[1.04] tracking-[-0.015em] text-balance">
              {tagline || company.name}
            </h1>
            {about && <p className="mt-7 text-lg text-white/70 leading-relaxed max-w-xl line-clamp-3">{about}</p>}
            <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a href={reservarUrl} className="px-8 py-4 rounded-full text-[#08080a] text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-full text-sm font-medium border border-white/25 hover:border-white/50 hover:bg-white/5 transition-colors inline-flex items-center gap-2">
                  <span className="text-green-400 text-[10px]">●</span> WhatsApp
                </a>
              )}
              {company.phone && (
                <a href={`tel:${company.phone}`} className="lux-link text-sm font-medium text-white/80 hover:text-white transition-colors ml-1">{t.call}</a>
              )}
            </div>
          </Reveal>
        </div>
        {/* Indicador de scroll */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 text-white/40">
          <span className="lux-scroll-cue h-9 w-px" style={{ background: `linear-gradient(${brandColor}, transparent)` }} />
        </div>
      </section>

      {/* Servicios alternados */}
      {services.length > 0 && (
        <section id="servicios" className="lux-grain relative py-28 lg:py-32 bg-[#0b0b0e]">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {sectionHeading(t.ourServices)}
            <div className="space-y-20 lg:space-y-24">
              {services.map((s, i) => (
                <Reveal key={s.id}>
                  <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div className={`group relative h-72 lg:h-[24rem] rounded-[1.25rem] overflow-hidden ring-1 ring-white/10 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                      <Image src={s.image_url || DEFAULT_CARS[i % DEFAULT_CARS.length]} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                    <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
                      {s.icon && <span className="text-3xl block mb-4 opacity-90">{s.icon}</span>}
                      <h3 className="font-playfair text-[1.75rem] lg:text-[2rem] font-medium tracking-[-0.01em] mb-5">{s.title}</h3>
                      {s.description && <p className="text-white/60 leading-relaxed text-[15px] max-w-lg">{s.description}</p>}
                      <a href={reservarUrl} className="lux-link inline-block mt-7 text-sm font-semibold" style={{ color: brandColor }}>{t.bookNow} →</a>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* La diferencia */}
      <section className="lux-grain relative isolate py-28 lg:py-32 overflow-hidden">
        <Image src={heroImg} alt="" fill sizes="100vw" className="object-cover -z-10" />
        <div className="absolute inset-0 -z-10 bg-[#08080a]/92" />
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal className="relative h-80 lg:h-[26rem] rounded-[1.25rem] overflow-hidden ring-1 ring-white/10">
            <Image src={fleet[0]?.base_image_url || DEFAULT_CARS[0]} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </Reveal>
          <Reveal>
            <span className="block h-px w-12 mb-6" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
            <h2 className="font-playfair text-[2rem] sm:text-4xl font-medium tracking-[-0.01em] mb-10">{t.whyTitle}</h2>
            <div className="space-y-8">
              {t.features.map((f) => (
                <div key={f.title} className="flex gap-5">
                  <span className="mt-3 h-px w-7 shrink-0" style={{ backgroundColor: brandColor }} />
                  <div>
                    <h3 className="font-playfair text-lg font-medium">{f.title}</h3>
                    <p className="text-sm text-white/60 mt-1.5 leading-relaxed max-w-md">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Flota */}
      {fleet.length > 0 && (
        <section id="flota" className="py-28 lg:py-32 bg-[#0b0b0e]">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {sectionHeading(t.ourFleet)}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {fleet.map((v, i) => (
                <Reveal key={v.id}>
                  <article className="group rounded-[1.25rem] overflow-hidden border border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.03] transition-colors h-full">
                    <div className="relative h-56 overflow-hidden">
                      <Image src={v.base_image_url || DEFAULT_CARS[i % DEFAULT_CARS.length]} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </div>
                    <div className="relative p-6">
                      <span className="absolute left-6 top-0 h-px w-0 group-hover:w-10 transition-all duration-500" style={{ backgroundColor: brandColor }} />
                      <h3 className="font-playfair text-xl font-medium">{v.name}</h3>
                      <p className="text-sm text-white/55 mt-1.5">{v.capacity} {t.pax}</p>
                      {(v.amenities ?? []).length > 0 && <p className="text-xs text-white/40 mt-3.5 leading-relaxed">{(v.amenities ?? []).join('  ·  ')}</p>}
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cómo reservar */}
      <section className="lux-grain relative py-28 lg:py-32 bg-[#08080a]">
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
          {sectionHeading(t.stepsTitle)}
          <div className="grid sm:grid-cols-3 gap-6">
            {t.steps.map((st, i) => (
              <Reveal key={st.title}>
                <div className="relative isolate rounded-[1.25rem] overflow-hidden h-72 flex items-end ring-1 ring-white/10">
                  <Image src={DEFAULT_CARS[(i + 2) % DEFAULT_CARS.length]} alt="" fill sizes="(max-width:1024px) 100vw, 33vw" className="object-cover -z-10" />
                  <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(rgba(8,8,10,0.15), rgba(8,8,10,0.95))' }} />
                  <div className="p-7">
                    <p className="font-playfair text-[2.5rem] leading-none font-medium" style={{ color: brandColor }}>{String(i + 1).padStart(2, '0')}</p>
                    <h3 className="font-playfair text-xl font-medium mt-3">{st.title}</h3>
                    <p className="text-sm text-white/65 mt-2 leading-relaxed">{st.desc}</p>
                  </div>
                </div>
              </Reveal>
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

      {/* Reservar (CTA → página de reserva en pantalla completa) + QR */}
      <section id="reservar" className="lux-grain relative isolate py-28 lg:py-32 overflow-hidden border-t border-white/[0.06] scroll-mt-16">
        <Image src={heroImg} alt="" fill sizes="100vw" className="object-cover -z-10" />
        <div className="absolute inset-0 -z-10 bg-[#08080a]/90" />
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 grid lg:grid-cols-[1.5fr_1fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <span className="block h-px w-12 mb-6" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
            <h2 className="font-playfair text-[2.25rem] sm:text-5xl font-medium tracking-[-0.015em] leading-[1.05] text-balance">{t.bookTitle}</h2>
            <p className="mt-5 text-lg text-white/65 leading-relaxed max-w-md">{t.bookCta}</p>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href={reservarUrl} className="px-8 py-4 rounded-full text-[#08080a] text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
              {company.phone && (
                <a href={`tel:${company.phone}`} className="lux-link text-sm font-medium text-white/80 hover:text-white transition-colors">{t.call}: {company.phone}</a>
              )}
            </div>
          </Reveal>
          <Reveal className="lg:justify-self-end rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR" className="w-44 h-44 mx-auto rounded-2xl bg-white p-2.5 shadow-lg shadow-black/40" />
            <h3 className="mt-6 font-playfair text-lg font-medium">{t.scanTitle}</h3>
            <p className="mt-1.5 text-sm text-white/50">{t.scanDesc}</p>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#060608] border-t border-white/[0.06]">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
            {/* Marca */}
            <div className="lg:col-span-5">
              <span className="font-playfair text-[1.6rem] font-medium tracking-[0.05em]">{company.name}</span>
              {tagline && <p className="mt-4 text-sm text-white/45 max-w-sm leading-relaxed">{tagline}</p>}
              <div className="mt-7 flex items-center gap-3">
                {company.phone && (
                  <a href={`tel:${company.phone}`} aria-label={t.call} className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-sm hover:bg-white/10 hover:border-white/30 transition-colors" style={{ color: brandColor }}>☎</a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} aria-label="Email" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-sm hover:bg-white/10 hover:border-white/30 transition-colors" style={{ color: brandColor }}>✉</a>
                )}
                {waNumber && (
                  <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center text-sm hover:bg-white/10 hover:border-white/30 transition-colors text-green-400">●</a>
                )}
              </div>
            </div>

            {/* Explora */}
            <div className="lg:col-span-3">
              <h4 className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-5">{t.footerExplore}</h4>
              <ul className="space-y-3 text-sm text-white/60">
                {services.length > 0 && <li><a href="#servicios" className="lux-link hover:text-white transition-colors">{t.ourServices}</a></li>}
                {fleet.length > 0 && <li><a href="#flota" className="lux-link hover:text-white transition-colors">{t.ourFleet}</a></li>}
                <li><a href={reservarUrl} className="lux-link hover:text-white transition-colors">{t.bookTitle}</a></li>
              </ul>
            </div>

            {/* Contacto */}
            <div className="lg:col-span-4">
              <h4 className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-5">{t.footerContact}</h4>
              <ul className="space-y-3 text-sm text-white/60">
                {company.phone && <li><a href={`tel:${company.phone}`} className="lux-link hover:text-white transition-colors">{company.phone}</a></li>}
                {company.email && <li><a href={`mailto:${company.email}`} className="lux-link hover:text-white transition-colors">{company.email}</a></li>}
                {waNumber && <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="lux-link hover:text-white transition-colors">WhatsApp</a></li>}
                {company.city && <li className="text-white/45">{company.city}</li>}
              </ul>
            </div>
          </div>

          {/* Barra inferior */}
          <div className="mt-16 pt-7 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/35">© {new Date().getFullYear()} {company.name}. {t.rights}</p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/30">Powered by {brand.name}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
