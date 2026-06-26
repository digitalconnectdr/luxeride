// ── Plantilla de micrositio: "Ivory" (claro / editorial) ──────────────────────
// Mismo DATA que la Noir, distinto diseño. Server component (sin hooks); usa
// LanguageSwitcher/Reveal/ReviewsCarousel (clientes) sin problema.

import Image from 'next/image'
import { Reveal } from '@/components/landing/reveal'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ReviewsCarousel } from '@/components/booking/reviews-carousel'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { GoogleReview } from '@/lib/reviews/google'

type MicrositeDict = Dictionary['microsite']

interface Service { id: string; title: string; description: string | null; icon: string | null; image_url: string | null }
interface Vehicle { id: string; name: string; class: string; capacity: number; amenities: string[] | null; base_image_url: string | null }
interface Reviews { reviews: GoogleReview[]; rating: number | null; total: number | null }

const WA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
)

export function MicrositeIvory(props: {
  company: { name: string; slug: string; city: string | null; phone: string | null; email: string | null }
  logoUrl: string | null
  tagline: string | null
  about: string | null
  heroImg: string
  brandColor: string
  services: Service[]
  fleet: Vehicle[]
  t: MicrositeDict
  locale: Locale
  reservarUrl: string
  waNumber: string
  qrDataUrl: string
  reviews: Reviews
}) {
  const { company, logoUrl, tagline, about, heroImg, brandColor, services, fleet, t, locale, reservarUrl, waNumber, qrDataUrl, reviews } = props

  const heading = (title: string) => (
    <Reveal className="mb-14 flex flex-col items-center text-center">
      <span className="h-px w-12" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />
      <h2 className="mt-6 font-playfair text-[2rem] sm:text-4xl lg:text-[2.6rem] font-medium tracking-[-0.01em] text-balance text-[#1d1b18]">{title}</h2>
    </Reveal>
  )

  const placeholder = (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#efeae0] to-[#e0d8c8]">
      <span className="h-px w-12" style={{ backgroundColor: brandColor }} />
    </div>
  )

  return (
    <div className="bg-[#f6f3ec] text-[#1d1b18] antialiased selection:bg-[var(--brand)]/20" style={{ ['--brand' as string]: brandColor }}>
      {/* Header */}
      <header id="top" className="sticky top-0 z-40 bg-[#f6f3ec]/85 backdrop-blur-md border-b border-black/[0.06]">
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}66, transparent)` }} />
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <span className="h-9 w-9 rounded-lg bg-white ring-1 ring-black/5 flex items-center justify-center shrink-0 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={company.name} className="max-h-full max-w-full object-contain" />
              </span>
            ) : null}
            <span className="font-playfair text-xl sm:text-[1.55rem] font-medium tracking-[0.02em] truncate">{company.name}</span>
          </a>
          <nav className="flex items-center gap-6 sm:gap-8 text-[13px] text-[#5b554b]">
            {services.length > 0 && <a href="#servicios" className="hidden md:inline-block hover:text-[#1d1b18] transition-colors">{t.ourServices}</a>}
            {fleet.length > 0 && <a href="#flota" className="hidden md:inline-block hover:text-[#1d1b18] transition-colors">{t.ourFleet}</a>}
            <LanguageSwitcher current={locale} variant="light" />
            <a href={reservarUrl} className="px-5 py-2 rounded-full text-white font-semibold text-xs tracking-wide transition-transform hover:scale-[1.04]" style={{ backgroundColor: brandColor }}>{t.bookNow}</a>
          </nav>
        </div>
      </header>

      {/* Hero editorial */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-14 lg:pt-20 pb-20 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <Reveal>
          <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.34em] text-[#8a8478] mb-7">
            <span className="h-px w-8" style={{ backgroundColor: brandColor }} />
            {company.city || 'Premium chauffeur service'}
          </p>
          <h1 className="font-playfair text-[2.7rem] sm:text-6xl lg:text-[4rem] font-medium leading-[1.05] tracking-[-0.015em] text-balance">
            {tagline || company.name}
          </h1>
          {about && <p className="mt-7 text-lg text-[#5b554b] leading-relaxed max-w-xl line-clamp-3">{about}</p>}
          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3">
            <a href={reservarUrl} className="px-8 py-4 rounded-full text-white text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
            {waNumber && (
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="px-7 py-4 rounded-full text-sm font-medium border border-black/15 hover:border-black/30 hover:bg-black/[0.03] transition-colors inline-flex items-center gap-2 text-[#25D366]">
                {WA} <span className="text-[#1d1b18]">WhatsApp</span>
              </a>
            )}
            {company.phone && <a href={`tel:${company.phone}`} className="text-sm font-medium text-[#5b554b] hover:text-[#1d1b18] transition-colors ml-1">{t.call}</a>}
          </div>
        </Reveal>
        <Reveal className="relative h-[24rem] lg:h-[34rem] rounded-[1.5rem] overflow-hidden ring-1 ring-black/10 shadow-2xl shadow-black/10">
          <Image src={heroImg} alt="" fill priority sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        </Reveal>
      </section>

      {/* Barra de confianza (oscura) — features + rating de Google */}
      {(t.features.length > 0 || reviews.rating != null) && (
        <section className="bg-[#1d1b18] text-white/90">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm">
            {t.features.slice(0, 3).map((f) => (
              <span key={f.title} className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                {f.title}
              </span>
            ))}
            {reviews.rating != null && (
              <span className="flex items-center gap-2.5">
                <span className="text-lg font-semibold" style={{ color: brandColor }}>{reviews.rating.toFixed(1)}</span>
                <span className="tracking-tight" style={{ color: brandColor }}>★★★★★</span>
                {reviews.total != null && <span className="text-white/45">· {reviews.total} {t.reviewsOnGoogle}</span>}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Servicios */}
      {services.length > 0 && (
        <section id="servicios" className="py-24 lg:py-28 bg-white">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {heading(t.ourServices)}
            <div className="space-y-16 lg:space-y-20">
              {services.map((s, i) => (
                <Reveal key={s.id}>
                  <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
                    <div className={`relative h-64 lg:h-[22rem] rounded-[1.25rem] overflow-hidden ring-1 ring-black/10 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                      {s.image_url ? <Image src={s.image_url} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" /> : placeholder}
                    </div>
                    <div className={i % 2 === 1 ? 'lg:order-1' : ''}>
                      {s.icon && <span className="text-3xl block mb-4">{s.icon}</span>}
                      <h3 className="font-playfair text-[1.7rem] lg:text-[2rem] font-medium tracking-[-0.01em] mb-4">{s.title}</h3>
                      {s.description && <p className="text-[#5b554b] leading-relaxed text-[15px] max-w-lg">{s.description}</p>}
                      <a href={reservarUrl} className="inline-block mt-7 text-sm font-semibold" style={{ color: brandColor }}>{t.bookNow} →</a>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Flota */}
      {fleet.length > 0 && (
        <section id="flota" className="py-24 lg:py-28 bg-[#f6f3ec]">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {heading(t.ourFleet)}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {fleet.map((v) => (
                <Reveal key={v.id}>
                  <article className="rounded-[1.25rem] overflow-hidden border border-black/[0.08] bg-white h-full">
                    <div className="relative h-52 overflow-hidden">
                      {v.base_image_url ? <Image src={v.base_image_url} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover" /> : placeholder}
                    </div>
                    <div className="p-6">
                      <h3 className="font-playfair text-xl font-medium">{v.name}</h3>
                      <p className="text-sm text-[#75716a] mt-1.5">{v.capacity} {t.pax}</p>
                      {(v.amenities ?? []).length > 0 && <p className="text-xs text-[#9a948a] mt-3 leading-relaxed">{(v.amenities ?? []).join('  ·  ')}</p>}
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cómo reservar */}
      <section className="py-24 lg:py-28 bg-white">
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
          {heading(t.stepsTitle)}
          <div className="grid sm:grid-cols-3 gap-6">
            {t.steps.map((st, i) => (
              <Reveal key={st.title} className="h-full">
                <div className="rounded-[1.25rem] h-full p-7 border border-black/[0.08] bg-[#faf8f3]">
                  <p className="font-playfair text-[2.75rem] leading-none font-medium" style={{ color: brandColor }}>{String(i + 1).padStart(2, '0')}</p>
                  <span className="block h-px w-10 my-5" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
                  <h3 className="font-playfair text-xl font-medium">{st.title}</h3>
                  <p className="text-sm text-[#5b554b] mt-2 leading-relaxed">{st.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Reseñas de Google */}
      {reviews.reviews.length > 0 && (
        <ReviewsCarousel reviews={reviews.reviews} rating={reviews.rating} total={reviews.total} title={t.reviewsTitle} reviewsLabel={t.reviewsOnGoogle} brandColor={brandColor} light />
      )}

      {/* Reservar desde el móvil (QR) + CTA */}
      <section className="py-24 lg:py-28 bg-[#f6f3ec]">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="block h-px w-12 mb-6" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
            <h2 className="font-playfair text-3xl sm:text-4xl font-medium tracking-[-0.01em]">{t.scanTitle}</h2>
            <p className="mt-3 text-[#5b554b] leading-relaxed max-w-md">{t.scanDesc}</p>
            <a href={reservarUrl} className="inline-block mt-8 px-8 py-4 rounded-full text-white text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
          </Reveal>
          <Reveal className="flex justify-center lg:justify-end">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10 shadow-xl shadow-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR" width={180} height={180} className="rounded-lg" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-black/[0.06]">
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 py-14 grid sm:grid-cols-3 gap-10">
          <div>
            <p className="font-playfair text-xl font-medium">{company.name}</p>
            {tagline && <p className="text-sm text-[#75716a] mt-2 max-w-xs leading-relaxed line-clamp-2">{tagline}</p>}
          </div>
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.28em] text-[#9a948a] mb-5">{t.footerExplore}</h4>
            <ul className="space-y-2.5 text-sm text-[#5b554b]">
              {services.length > 0 && <li><a href="#servicios" className="hover:text-[#1d1b18] transition-colors">{t.ourServices}</a></li>}
              {fleet.length > 0 && <li><a href="#flota" className="hover:text-[#1d1b18] transition-colors">{t.ourFleet}</a></li>}
              <li><a href={reservarUrl} className="hover:text-[#1d1b18] transition-colors">{t.bookNow}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.28em] text-[#9a948a] mb-5">{t.footerContact}</h4>
            <ul className="space-y-2.5 text-sm text-[#5b554b]">
              {company.phone && <li><a href={`tel:${company.phone}`} className="hover:text-[#1d1b18] transition-colors">{company.phone}</a></li>}
              {company.email && <li><a href={`mailto:${company.email}`} className="hover:text-[#1d1b18] transition-colors">{company.email}</a></li>}
              {waNumber && <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#1d1b18] transition-colors">WhatsApp</a></li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-black/[0.06] py-6">
          <p className="max-w-[1300px] mx-auto px-6 lg:px-10 text-[11px] text-[#9a948a]">© {new Date().getFullYear()} {company.name}. {t.rights}</p>
        </div>
      </footer>
    </div>
  )
}
