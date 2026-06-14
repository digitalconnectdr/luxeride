import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { BookingWizard } from './booking-wizard'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

interface Props {
  params: { slug: string }
}

// SEO por operador: cada portal /<slug> es indexable bajo el dominio de
// LuxeRide, con título, descripción y Open Graph propios de la empresa.
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
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: company.name,
      images: company.logo_url ? [{ url: company.logo_url }] : undefined,
    },
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
    .select('id, name, slug, status, currency, primary_color, phone, email, city, address, logo_url, tagline, hero_image_url, about, stripe_connect_onboarded, settings')
    .eq('slug', params.slug)
    .single()

  if (!company || company.status !== 'active') return notFound()

  const [{ data: vehicleTypes }, { data: servicesRaw }] = await Promise.all([
    admin
      .from('vehicle_types')
      .select('id, name, class, capacity, amenities, base_image_url')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('sort_order'),
    admin
      .from('company_services')
      .select('id, title, description, icon, image_url')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const services = (servicesRaw ?? []) as CompanyService[]
  const brandColor = (company.primary_color as string | null) ?? '#1d1d1f'
  const heroImage = (company as { hero_image_url?: string | null }).hero_image_url ?? null
  const tagline = (company as { tagline?: string | null }).tagline ?? null
  const about = (company as { about?: string | null }).about ?? null
  const logoUrl = (company as { logo_url?: string | null }).logo_url ?? null

  // Link corto (canónico) + QR para reservar desde el móvil
  const shortUrl = `${getAppUrl()}/${company.slug}`
  const qrDataUrl = await QRCode.toDataURL(shortUrl, {
    width: 220,
    margin: 1,
    color: { dark: '#1d1d1f', light: '#ffffff' },
  })

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': shortUrl,
    name: company.name,
    url: shortUrl,
    priceRange: '$$$',
    description: tagline || `${company.name} — servicio de transporte premium.`,
  }
  if (logoUrl) jsonLd.image = logoUrl
  if (company.phone) jsonLd.telephone = company.phone
  if (company.email) jsonLd.email = company.email
  if (company.city) jsonLd.areaServed = company.city
  if (services.length > 0) {
    jsonLd.makesOffer = services.map((s) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: s.title, description: s.description ?? undefined },
    }))
  }

  return (
    <div style={{ ['--brand' as string]: brandColor }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden text-center"
        style={
          heroImage
            ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.65)), url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: `linear-gradient(135deg, ${brandColor} 0%, #1d1d1f 130%)` }
        }
      >
        <div className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={company.name} className="h-16 mx-auto mb-6 object-contain drop-shadow" />
          ) : null}
          <h1 className="font-playfair text-4xl sm:text-5xl font-semibold text-white drop-shadow-sm">
            {company.name}
          </h1>
          {tagline && (
            <p className="mt-4 text-lg sm:text-xl text-white/85 font-light">{tagline}</p>
          )}
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <a
              href="#reservar"
              className="px-7 py-3.5 rounded-full text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: brandColor }}
            >
              {t.bookNow} →
            </a>
            {company.phone && (
              <a
                href={`tel:${company.phone}`}
                className="px-7 py-3.5 rounded-full text-sm font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors"
              >
                {t.call}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── SERVICIOS ── */}
      {services.length > 0 && (
        <section className="bg-[#faf8f3] border-b border-[#ece8df]">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <h2 className="font-playfair text-2xl sm:text-3xl font-semibold text-[#1d1b18] text-center mb-10">
              {t.ourServices}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((s) => (
                <div key={s.id} className="bg-white border border-[#ece8df] rounded-2xl p-6 text-center">
                  {s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image_url} alt={s.title} className="h-14 w-14 object-cover rounded-xl mx-auto mb-4" />
                  ) : (
                    <div
                      className="h-14 w-14 rounded-xl mx-auto mb-4 flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${brandColor}1a` }}
                    >
                      <span>{s.icon || '✦'}</span>
                    </div>
                  )}
                  <h3 className="font-semibold text-[#1d1b18]">{s.title}</h3>
                  {s.description && (
                    <p className="mt-2 text-sm text-[#75716a] leading-relaxed">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT ── */}
      {about && (
        <section className="bg-white border-b border-[#ece8df]">
          <div className="max-w-2xl mx-auto px-6 py-14 text-center">
            <h2 className="font-playfair text-2xl font-semibold text-[#1d1b18] mb-4">{t.aboutTitle}</h2>
            <p className="text-[#5c584f] leading-relaxed whitespace-pre-line">{about}</p>
          </div>
        </section>
      )}

      {/* ── RESERVAR (formulario embebido) ── */}
      <section id="reservar" className="bg-[#f5f5f7] scroll-mt-16">
        <div className="max-w-2xl mx-auto px-6 py-14">
          <h2 className="font-playfair text-2xl sm:text-3xl font-semibold text-[#1d1b18] text-center mb-8">
            {t.bookTitle}
          </h2>
          <BookingWizard
            company={{
              id:           company.id,
              name:         company.name,
              slug:         company.slug,
              currency:     (company.currency as string | null) ?? 'USD',
              primaryColor: brandColor,
              phone:        (company.phone as string | null) ?? null,
              email:        (company.email as string | null) ?? null,
            }}
            vehicleTypes={(vehicleTypes ?? []).map((vt) => ({
              id:         vt.id,
              name:       vt.name,
              class:      vt.class,
              capacity:   vt.capacity,
              amenities:  vt.amenities ?? [],
              imageUrl:   vt.base_image_url ?? null,
            }))}
            onlinePaymentsEnabled={isStripeConfigured() && Boolean(company.stripe_connect_onboarded)}
            dict={dict.wizard}
            localeTag={LOCALE_TAGS[locale] ?? 'en-US'}
            gratuity={(() => {
              const g = (company.settings as {
                gratuity?: { enabled?: boolean; options?: number[]; default_percentage?: number }
                booking?: { require_deposit?: boolean }
              } | null)?.gratuity
              const requiresDeposit = Boolean(
                (company.settings as { booking?: { require_deposit?: boolean } } | null)?.booking?.require_deposit,
              )
              return {
                enabled: (g?.enabled ?? true) && !requiresDeposit,
                options: g?.options ?? [15, 18, 20, 25],
                defaultPct: g?.default_percentage ?? 20,
              }
            })()}
          />
        </div>
      </section>

      {/* ── QR / reservar desde el móvil ── */}
      <section className="bg-white">
        <div className="max-w-md mx-auto px-6 py-14 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR" className="w-40 h-40 mx-auto rounded-xl border border-[#ece8df]" />
          <h3 className="mt-5 font-semibold text-[#1d1b18]">{t.scanTitle}</h3>
          <p className="mt-1 text-sm text-[#75716a]">{t.scanDesc}</p>
        </div>
      </section>
    </div>
  )
}
