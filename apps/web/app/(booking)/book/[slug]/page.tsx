import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { resolveLocalizedField, type SiteI18n, type ServiceI18n } from '@/lib/i18n/site-content'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { fetchGoogleReviews } from '@/lib/reviews/google'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ReviewsCarousel } from '@/components/booking/reviews-carousel'
import { Reveal } from '@/components/landing/reveal'
import { ServiceWorkerRegister } from '@/components/pwa/sw-register'
import { PaymentMethodsMarquee } from '@/components/booking/payment-methods-marquee'
import { MicrositeIvory } from '@/components/booking/microsite-ivory'
import { MicrositeBold } from '@/components/booking/microsite-bold'
import { MicrositeCorporate } from '@/components/booking/microsite-corporate'
import { MicrositePending } from '@/components/booking/microsite-pending'
import { BookingWizard } from './booking-wizard'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }
const U = (slug: string) => `https://unsplash.com/photos/${slug}/download?force=true&w=1600`
const DEFAULT_HERO = U('9XVJ-Jq7Ke8')

// Glifo de WhatsApp (para los enlaces "contáctanos por WhatsApp" del micrositio).
function WhatsAppIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

interface Props {
  params: { slug: string }
  searchParams?: { preview?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = getLocale()
  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('name, city, logo_url, tagline, primary_color, settings')
    .eq('slug', params.slug)
    .single()
  if (!company) return { title: { absolute: 'Reservación' } }

  const site = ((company.settings as { site?: { i18n?: SiteI18n } } | null)?.site) ?? {}
  const tagline = resolveLocalizedField(site.i18n, locale, 'tagline', (company as { tagline?: string | null }).tagline ?? null)
  const cityPart = company.city ? ` · ${company.city}` : ''
  const inCity = company.city ? ` en ${company.city}` : ''
  const title = `${company.name} — ${tagline || `Reserva tu traslado de lujo${cityPart}`}`
  const description = `Reserva en línea con ${company.name}: traslados al aeropuerto, chofer ejecutivo y transporte premium${inCity}. Cotización al instante, pago seguro y seguimiento en vivo.`
  const url = `${getAppUrl()}/book/${params.slug}`
  return {
    // White-label: la pestaña muestra SOLO la marca del operador, nunca "| LuxeRide"
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, type: 'website', siteName: company.name, images: company.logo_url ? [{ url: company.logo_url }] : undefined },
    // PWA branded: manifest dinámico + ícono/título de la "app" del operador (iOS).
    manifest: `/manifest/${params.slug}`,
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: company.name },
    // Favicon + apple-touch-icon = logo del operador (white-label).
    ...(company.logo_url ? { icons: { icon: [{ url: company.logo_url }], apple: [{ url: company.logo_url }] } } : {}),
  }
}

interface CompanyService {
  id: string
  title: string
  description: string | null
  icon: string | null
  image_url: string | null
  i18n?: ServiceI18n | null
}

export default async function OperatorMicrosite({ params, searchParams }: Props) {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.microsite
  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, status, currency, primary_color, phone, email, city, logo_url, tagline, hero_image_url, about, stripe_connect_onboarded, whop_connect_onboarded, settings')
    .eq('slug', params.slug)
    .single()
  if (!company) return notFound()
  if (company.status !== 'active') {
    return (
      <MicrositePending
        companyName={company.name}
        logoUrl={company.logo_url}
        brandColor={company.primary_color}
        phone={company.phone}
        email={company.email}
        t={t}
      />
    )
  }

  const placeId = ((company.settings as { site?: { googlePlaceId?: string } } | null)?.site)?.googlePlaceId
  const [{ data: vehicleTypes }, { data: servicesRaw }, googleReviews] = await Promise.all([
    admin.from('vehicle_types').select('id, name, class, capacity, amenities, base_image_url').eq('company_id', company.id).eq('is_active', true).order('sort_order'),
    admin.from('company_services').select('id, title, description, icon, image_url, i18n').eq('company_id', company.id).eq('is_active', true).order('sort_order'),
    fetchGoogleReviews(placeId, locale),
  ])

  // Título/descripción por idioma (Ajustes → Servicios → pestañas EN/ES/PT),
  // con el mismo fallback que tagline/about: idioma actual → ES → columna legada.
  const services = ((servicesRaw ?? []) as CompanyService[]).map((s) => ({
    ...s,
    title: resolveLocalizedField(s.i18n, locale, 'title', s.title) ?? s.title,
    description: resolveLocalizedField(s.i18n, locale, 'description', s.description),
  }))
  const fleet = vehicleTypes ?? []
  // Tarjeta online solo si la empresa completó el onboarding de Whop Connect
  // (Stripe Connect queda fuera de foco por ahora — ver STRIPE_CONNECT_ENABLED
  // en admin/settings). Efectivo/Zelle/transferencia siempre están disponibles.
  const acceptsCardOnline = Boolean((company as { whop_connect_onboarded?: boolean }).whop_connect_onboarded)
  const brandColor = (company.primary_color as string | null) || '#c9a24b'
  const heroImg = (company as { hero_image_url?: string | null }).hero_image_url || DEFAULT_HERO
  const logoUrl = (company as { logo_url?: string | null }).logo_url ?? null
  const site = ((company.settings as { site?: { whatsapp?: string; googlePlaceId?: string; template?: string; i18n?: SiteI18n } } | null)?.site) ?? {}
  const tagline = resolveLocalizedField(site.i18n, locale, 'tagline', (company as { tagline?: string | null }).tagline ?? null)
  const about = resolveLocalizedField(site.i18n, locale, 'about', (company as { about?: string | null }).about ?? null)
  const waNumber = (site.whatsapp ?? '').replace(/[^0-9]/g, '')
  const reservarUrl = `/book/${company.slug}/reservar`
  // Plantilla guardada por el operador; `?preview=ivory|noir|bold|corporate` la
  // sobreescribe SOLO para previsualizar (no cambia el ajuste), útil antes de
  // aplicar el diseño.
  const TEMPLATE_IDS = ['noir', 'ivory', 'bold', 'corporate'] as const
  const previewTpl = searchParams?.preview
  const template = (TEMPLATE_IDS as readonly string[]).includes(previewTpl ?? '')
    ? (previewTpl as (typeof TEMPLATE_IDS)[number])
    : (TEMPLATE_IDS as readonly string[]).includes(site.template ?? '')
      ? (site.template as (typeof TEMPLATE_IDS)[number])
      : 'noir'

  const shortUrl = `${getAppUrl()}/book/${company.slug}`
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

  // ── Selector de plantilla ──────────────────────────────────────────────────
  // El operador elige el diseño en Ajustes → Portada. Mismo DATA, distinto layout.
  if (template !== 'noir') {
    const sharedProps = {
      company: { name: company.name, slug: company.slug, city: company.city, phone: company.phone, email: company.email },
      logoUrl, tagline, about, heroImg, brandColor, services, fleet, t, locale,
      reservarUrl, waNumber, qrDataUrl, reviews: googleReviews, acceptsCardOnline,
    }
    const Template = template === 'ivory' ? MicrositeIvory : template === 'bold' ? MicrositeBold : MicrositeCorporate
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ServiceWorkerRegister />
        <Template {...sharedProps} />
      </>
    )
  }

  return (
    <div className="bg-[#08080a] text-white antialiased selection:bg-[var(--brand)]/30" style={{ ['--brand' as string]: brandColor }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ServiceWorkerRegister />

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
                  <WhatsAppIcon size={16} className="text-[#25D366]" /> WhatsApp
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
                      {s.image_url ? (
                        <>
                          <Image src={s.image_url} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        </>
                      ) : (
                        // Sin foto propia: ícono del servicio en vez de una foto genérica que
                        // podría no corresponder (ej. una furgoneta nevada para "Bodas y eventos").
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.07] via-transparent to-transparent">
                          <span className="text-7xl transition-transform duration-700 group-hover:scale-110" style={{ filter: `drop-shadow(0 0 24px ${brandColor}33)` }}>{s.icon || '✦'}</span>
                        </div>
                      )}
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
      <section className="lux-grain relative isolate py-28 lg:py-32 overflow-hidden bg-[#0a0a0d]">
        <Image src={heroImg} alt="" fill sizes="100vw" className="object-cover -z-10 opacity-40" />
        {/* Degradado casi opaco del lado del texto para garantizar legibilidad */}
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(90deg, rgba(10,10,13,0.7) 0%, rgba(10,10,13,0.9) 45%, rgba(10,10,13,0.98) 100%)' }} />
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal className="relative h-80 lg:h-[26rem] rounded-[1.25rem] overflow-hidden ring-1 ring-white/10 bg-gradient-to-br from-[#e6e2d9] via-[#8c887e] to-[#2f2e33] flex items-center justify-center p-4 lg:p-6">
            {/* Imagen ESTÁTICA y DISTINTA de "La diferencia" — lineup de flota premium (cutout PNG transparente).
                No se liga a la flota subida ni repite la de "Nuestros servicios". */}
            {/* Backdrop de estudio con presencia: spotlight central que ilumina los autos
                + viñeta inferior que los asienta sobre el "piso" y da profundidad. */}
            <span aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(56% 54% at 50% 34%, rgba(255,255,255,0.6), transparent 68%)' }} />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to top, rgba(18,18,20,0.5), transparent)' }} />
            <Image src="/microsite/fleet-lineup.png" alt="Flota premium" width={760} height={300} sizes="(max-width:1024px) 100vw, 50vw" className="relative z-10 w-full h-auto object-contain drop-shadow-2xl" />
          </Reveal>
          <Reveal>
            <span className="block h-px w-12 mb-6" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
            <h2 className="font-playfair text-[2rem] sm:text-4xl font-medium tracking-[-0.01em] mb-10">{t.whyTitle}</h2>
            <div className="space-y-8">
              {t.features.map((f) => (
                <div key={f.title} className="flex gap-5">
                  <span className="mt-3 h-px w-7 shrink-0" style={{ backgroundColor: brandColor }} />
                  <div>
                    <h3 className="font-playfair text-lg font-medium text-white">{f.title}</h3>
                    <p className="text-sm text-white/75 mt-1.5 leading-relaxed max-w-md">{f.desc}</p>
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
                      {v.base_image_url ? (
                        <>
                          <Image src={v.base_image_url} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        </>
                      ) : (
                        // Placeholder elegante: sin foto real → no mostramos un auto que no corresponde,
                        // solo la inicial de la marca en serif (mismo tratamiento que la plantilla Ivory).
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.07] via-transparent to-transparent">
                          <span className="font-playfair text-5xl transition-transform duration-700 group-hover:scale-110" style={{ color: `${brandColor}55` }}>{company.name.charAt(0)}</span>
                        </div>
                      )}
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
              <Reveal key={st.title} className="h-full">
                {/* Tarjeta numerada elegante (sin foto → evita repetir imágenes) */}
                <div className="relative rounded-[1.25rem] h-full p-7 border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01]">
                  <p className="font-playfair text-[2.75rem] leading-none font-medium" style={{ color: brandColor }}>{String(i + 1).padStart(2, '0')}</p>
                  <span className="block h-px w-10 my-5" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
                  <h3 className="font-playfair text-xl font-medium">{st.title}</h3>
                  <p className="text-sm text-white/65 mt-2 leading-relaxed">{st.desc}</p>
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

      {/* Formas de pago — cinta con desplazamiento lateral */}
      <section className="py-20 lg:py-24 bg-[#0b0b0e] border-t border-white/[0.06]">
        <PaymentMethodsMarquee acceptsCardOnline={acceptsCardOnline} t={t} tone="dark" brandColor={brandColor} />
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
                  <a href={`tel:${company.phone}`} aria-label={t.call} className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-colors" style={{ color: brandColor }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  </a>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} aria-label="Email" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-colors" style={{ color: brandColor }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  </a>
                )}
                {waNumber && (
                  <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-colors text-[#25D366]"><WhatsAppIcon size={17} /></a>
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
