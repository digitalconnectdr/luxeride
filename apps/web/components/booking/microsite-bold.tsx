// ── Plantilla de micrositio: "Bold" (editorial gráfico — negro/blanco + acento) ─
// Mismo DATA que Noir/Ivory, distinto diseño. Inspirado en revistas de moda de
// lujo: tipografía sans enorme y pesada, bloques de color contundentes, grid
// asimétrico, panels alternados blanco/negro, ticker en movimiento continuo.
// Server component (sin hooks); usa clientes (LanguageSwitcher/Reveal/Reviews)
// sin problema.

import Image from 'next/image'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ReviewsCarousel } from '@/components/booking/reviews-carousel'
import { CategoryIcon } from '@/components/booking/vehicle-category-icons'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { GoogleReview } from '@/lib/reviews/google'

type MicrositeDict = Dictionary['microsite']

interface Service { id: string; title: string; description: string | null; icon: string | null; image_url: string | null }
interface Vehicle { id: string; name: string; class: string; capacity: number; amenities: string[] | null; base_image_url: string | null }
interface Reviews { reviews: GoogleReview[]; rating: number | null; total: number | null }

const CLASS_LABEL: Record<string, string> = {
  sedan: 'Sedan', suv: 'SUV', van: 'Van', minivan: 'Minivan', suburban: 'Suburban',
  limousine: 'Limousine', limo: 'Limo', sprinter: 'Sprinter', bus: 'Bus', coach: 'Coach',
  exotic: 'Exotic', luxury: 'Luxury', vip: 'VIP',
}
const classLabel = (c: string) => CLASS_LABEL[c] ?? (c.charAt(0).toUpperCase() + c.slice(1))

const U = (slug: string) => `https://unsplash.com/photos/${slug}/download?force=true&w=1600`
const SERVICE_DEFAULTS = [U('NjQmytqwDGs'), U('7I8qdKTHDp4'), U('4Dofvf-eUMs'), U('FZ5MkHkeyKM')]

const WA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
)
const PaxIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

export function MicrositeBold(props: {
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

  const eyebrow = (label: string, dark = false) => (
    <p className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] mb-4 ${dark ? 'text-white/60' : 'text-black/45'}`}>
      <span className="h-2 w-2 shrink-0" style={{ backgroundColor: brandColor }} />{label}
    </p>
  )

  const placeholder = (dark = false) => (
    <div className={`absolute inset-0 flex items-center justify-center ${dark ? 'bg-white/[0.06]' : 'bg-black/[0.05]'}`}>
      <span className="font-sans font-black text-5xl" style={{ color: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)' }}>{company.name.charAt(0)}</span>
    </div>
  )

  // Ticker: mezcla de servicios/features fijos del operador, repetido para el loop.
  const tickerWords = [company.name, ...t.features.map((f) => f.title), t.ourFleet, t.ourServices]

  return (
    <div className="bg-white text-[#0a0a0a] antialiased font-sans selection:bg-[var(--brand)]/25" style={{ ['--brand' as string]: brandColor }}>
      {/* Header */}
      <header id="top" className="sticky top-0 z-40 bg-black text-white">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3 min-w-0">
            {logoUrl && (
              <span className="h-9 w-9 bg-white flex items-center justify-center shrink-0 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={company.name} className="max-h-full max-w-full object-contain" />
              </span>
            )}
            <span className="font-sans font-black text-lg sm:text-xl uppercase tracking-tight truncate">{company.name}</span>
          </a>
          <nav className="flex items-center gap-6 sm:gap-8 text-[12px] font-semibold uppercase tracking-wide text-white/70">
            {fleet.length > 0 && <a href="#categorias" className="hidden md:inline-block hover:text-white transition-colors">{t.browseCategory}</a>}
            {fleet.length > 0 && <a href="#flota" className="hidden md:inline-block hover:text-white transition-colors">{t.ourFleet}</a>}
            {services.length > 0 && <a href="#servicios" className="hidden lg:inline-block hover:text-white transition-colors">{t.ourServices}</a>}
            <LanguageSwitcher current={locale} variant="dark" />
            <a href={reservarUrl} className="px-5 py-2.5 font-black text-xs tracking-wide transition-transform hover:scale-[1.04]" style={{ backgroundColor: brandColor, color: '#0a0a0a' }}>{t.bookNow}</a>
          </nav>
        </div>
      </header>

      {/* HERO — asimétrico: bloque negro con titular enorme + foto a sangre */}
      <section className="grid lg:grid-cols-[1.15fr_0.85fr] min-h-[86vh]">
        <div className="relative bg-black text-white flex items-center px-6 sm:px-10 lg:px-16 py-20 lg:py-0 order-2 lg:order-1">
          <Reveal className="max-w-xl">
            {eyebrow(company.city || 'Premium chauffeur service', true)}
            <h1 className="font-sans font-black text-[3rem] sm:text-6xl lg:text-[4.4rem] leading-[0.95] tracking-[-0.03em] text-balance uppercase">
              {tagline || company.name}
            </h1>
            {about && <p className="mt-7 text-white/70 leading-relaxed max-w-md line-clamp-3">{about}</p>}
            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a href={reservarUrl} className="px-8 py-4 font-black text-sm tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor, color: '#0a0a0a' }}>{t.bookNow} →</a>
              {fleet.length > 0 && (
                <a href="#flota" className="px-7 py-4 text-sm font-bold border-2 border-white/30 hover:border-white transition-colors">{t.viewFleet}</a>
              )}
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-white/80 hover:text-white transition-colors ml-1">
                  <span className="text-[#25D366]">{WA}</span> WhatsApp
                </a>
              )}
            </div>
          </Reveal>
          <span className="hidden lg:block absolute right-0 top-0 h-full w-1.5" style={{ backgroundColor: brandColor }} />
        </div>
        <div className="relative h-[42vh] lg:h-auto order-1 lg:order-2 overflow-hidden">
          <Image src={heroImg} alt="" fill priority sizes="(max-width:1024px) 100vw, 45vw" className="object-cover" />
        </div>
      </section>

      {/* TICKER continuo */}
      <div className="overflow-hidden py-3.5" style={{ backgroundColor: brandColor }}>
        <div className="flex w-max lux-marquee">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex items-center shrink-0">
              {tickerWords.map((w, i) => (
                <span key={`${rep}-${i}`} className="flex items-center shrink-0 font-black text-sm uppercase tracking-wide text-black px-5">
                  {w}
                  <span className="ml-5 text-black/40">—</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* EXPLORA POR CATEGORÍA — mosaico de tiles con número e ícono */}
      {fleet.length > 0 && (
        <section id="categorias" className="py-24 lg:py-28">
          <div className="max-w-[1500px] mx-auto px-6 lg:px-10">
            {eyebrow(t.browseCategory)}
            <h2 className="font-sans font-black text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-[-0.02em] uppercase mb-14 max-w-3xl">{t.categoryTitle}</h2>
            <RevealStagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-l border-black/10">
              {t.categories.map((c, i) => (
                <RevealItem key={c.label} className={`group border-r border-b border-black/10 p-6 transition-colors ${i % 5 === 0 ? 'bg-black text-white' : 'hover:bg-black/[0.03]'}`}>
                  <p className="font-sans font-black text-xs opacity-40 mb-6">{String(i + 1).padStart(2, '0')}</p>
                  <span className="block h-9 w-12 mb-5" style={{ color: i % 5 === 0 ? brandColor : brandColor }}>
                    <CategoryIcon index={i} />
                  </span>
                  <p className="text-sm font-black uppercase tracking-wide">{c.label}</p>
                  <p className={`text-xs mt-1.5 ${i % 5 === 0 ? 'text-white/50' : 'text-black/45'}`}>{c.sub}</p>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      )}

      {/* FLOTA — grid asimétrico (el primer vehículo ocupa el doble) */}
      {fleet.length > 0 && (
        <section id="flota" className="py-24 lg:py-28 bg-black text-white">
          <div className="max-w-[1500px] mx-auto px-6 lg:px-10">
            {eyebrow(t.ourFleet, true)}
            <h2 className="font-sans font-black text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-[-0.02em] uppercase mb-14 max-w-3xl">{t.popularFleet}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
              {fleet.map((v, i) => (
                <Reveal key={v.id} className={i === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}>
                  <article className="group relative bg-black h-full flex flex-col">
                    <div className={`relative overflow-hidden ${i === 0 ? 'h-72 lg:h-96' : 'h-56'}`}>
                      {v.base_image_url
                        ? <Image src={v.base_image_url} alt={v.name} fill sizes={i === 0 ? '(max-width:1024px) 100vw, 66vw' : '(max-width:1024px) 50vw, 33vw'} className="object-cover transition-transform duration-700 group-hover:scale-105" />
                        : placeholder(true)}
                      <span className="absolute top-4 left-4 px-3 py-1 font-black text-[11px] uppercase tracking-wide" style={{ backgroundColor: brandColor, color: '#0a0a0a' }}>{classLabel(v.class)}</span>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-sans font-black text-xl uppercase tracking-tight">{v.name}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/55">
                        <span className="inline-flex items-center gap-1.5">{PaxIcon} {v.capacity} {t.pax}</span>
                        {(v.amenities ?? []).slice(0, 2).map((a) => (
                          <span key={a} className="inline-flex items-center gap-1.5"><span className="h-1 w-1 bg-current opacity-40" />{a}</span>
                        ))}
                      </div>
                      <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[13px] font-bold" style={{ color: brandColor }}>{t.quoteOnRequest}</span>
                        <a href={reservarUrl} className="px-5 py-2.5 font-black text-xs uppercase tracking-wide" style={{ backgroundColor: brandColor, color: '#0a0a0a' }}>{t.bookNow}</a>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BARRA DE STATS — bloque de color contundente */}
      {(t.features.length > 0 || reviews.rating != null) && (
        <section style={{ backgroundColor: brandColor }}>
          <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10 text-black">
            {t.features.slice(0, reviews.rating != null ? 3 : 4).map((f) => (
              <div key={f.title}>
                <p className="text-sm font-black uppercase tracking-wide">{f.title}</p>
                <p className="text-xs mt-2 leading-relaxed opacity-70 line-clamp-2">{f.desc}</p>
              </div>
            ))}
            {reviews.rating != null && (
              <div>
                <p className="font-sans font-black text-5xl leading-none">{reviews.rating.toFixed(1)}</p>
                <p className="text-xs mt-2 opacity-70">★★★★★ {reviews.total != null ? `· ${reviews.total} ${t.reviewsOnGoogle}` : t.reviewsOnGoogle}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SERVICIOS — paneles a sangre alternados blanco/negro */}
      {services.length > 0 && (
        <section id="servicios">
          {services.map((s, i) => {
            const dark = i % 2 === 1
            return (
              <Reveal key={s.id}>
                <div className={`grid lg:grid-cols-2 min-h-[60vh] ${dark ? 'bg-black text-white' : 'bg-white text-[#0a0a0a]'}`}>
                  <div className={`relative h-64 lg:h-auto overflow-hidden ${dark ? 'lg:order-2' : ''}`}>
                    <Image src={s.image_url || SERVICE_DEFAULTS[i % SERVICE_DEFAULTS.length]} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
                  </div>
                  <div className={`flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-16 lg:py-0 ${dark ? 'lg:order-1' : ''}`}>
                    <p className="font-sans font-black text-xs opacity-40 mb-5">{String(i + 1).padStart(2, '0')}</p>
                    <h3 className="font-sans font-black text-3xl lg:text-4xl uppercase tracking-tight leading-[0.98] mb-5 max-w-md">{s.title}</h3>
                    {s.description && <p className={`leading-relaxed max-w-md ${dark ? 'text-white/65' : 'text-black/60'}`}>{s.description}</p>}
                    <a href={reservarUrl} className="inline-flex items-center gap-2 mt-7 text-sm font-black uppercase tracking-wide w-fit" style={{ color: brandColor }}>{t.bookNow} →</a>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </section>
      )}

      {/* CÓMO RESERVAR */}
      <section className="py-24 lg:py-28">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10">
          {eyebrow(t.stepsTitle)}
          <h2 className="font-sans font-black text-4xl sm:text-5xl uppercase tracking-[-0.02em] mb-14">{t.stepsTitle}</h2>
          <div className="grid sm:grid-cols-3 border-t border-black/10">
            {t.steps.map((st, i) => (
              <Reveal key={st.title} className={`p-8 ${i > 0 ? 'sm:border-l border-black/10' : ''}`}>
                <p className="font-sans font-black text-6xl leading-none" style={{ color: brandColor }}>{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-sans font-black text-lg uppercase tracking-tight mt-6">{st.title}</h3>
                <p className="text-sm text-black/55 mt-2 leading-relaxed">{st.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      {reviews.reviews.length > 0 && (
        <ReviewsCarousel reviews={reviews.reviews} rating={reviews.rating} total={reviews.total} title={t.reviewsTitle} reviewsLabel={t.reviewsOnGoogle} brandColor={brandColor} variant="bold" />
      )}

      {/* CTA MEMBRESÍA — bloque de color invertido */}
      <section className="bg-black text-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-24 lg:py-28 text-center">
          <h2 className="font-sans font-black text-4xl sm:text-6xl uppercase tracking-[-0.02em] leading-[0.95]">{t.membershipTitle}</h2>
          <p className="mt-6 text-white/70 leading-relaxed max-w-lg mx-auto">{t.membershipText}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <a href={reservarUrl} className="px-9 py-4 font-black text-sm uppercase tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor, color: '#0a0a0a' }}>{t.bookNow} →</a>
            {company.phone && <a href={`tel:${company.phone}`} className="text-sm font-bold text-white/80 hover:text-white transition-colors">{t.call}: {company.phone}</a>}
          </div>
        </div>
      </section>

      {/* RESERVA DESDE EL MÓVIL (QR) */}
      <section className="py-20 lg:py-24">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <h2 className="font-sans font-black text-3xl sm:text-4xl uppercase tracking-[-0.01em]">{t.scanTitle}</h2>
            <p className="mt-3 text-black/60 leading-relaxed max-w-md">{t.scanDesc}</p>
            <a href={reservarUrl} className="inline-block mt-8 px-8 py-4 font-black text-sm uppercase tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor, color: '#0a0a0a' }}>{t.bookNow} →</a>
          </Reveal>
          <Reveal className="flex justify-center lg:justify-end">
            <div className="bg-black p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR" width={180} height={180} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black text-white/70">
        <div className="max-w-[1500px] mx-auto px-6 lg:px-10 py-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="font-sans font-black text-xl uppercase tracking-tight text-white">{company.name}</span>
            {tagline && <p className="mt-5 text-sm text-white/45 max-w-sm leading-relaxed">{tagline}</p>}
            <div className="mt-7 flex items-center gap-3">
              {company.phone && (
                <a href={`tel:${company.phone}`} aria-label={t.call} className="h-9 w-9 border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: brandColor }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                </a>
              )}
              {company.email && (
                <a href={`mailto:${company.email}`} aria-label="Email" className="h-9 w-9 border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: brandColor }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </a>
              )}
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="h-9 w-9 border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors text-[#25D366]">{WA}</a>
              )}
            </div>
          </div>
          <div className="lg:col-span-3">
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-5">{t.footerExplore}</h4>
            <ul className="space-y-3 text-sm text-white/60">
              {fleet.length > 0 && <li><a href="#flota" className="hover:text-white transition-colors">{t.ourFleet}</a></li>}
              {services.length > 0 && <li><a href="#servicios" className="hover:text-white transition-colors">{t.ourServices}</a></li>}
              <li><a href={reservarUrl} className="hover:text-white transition-colors">{t.bookNow}</a></li>
            </ul>
          </div>
          <div className="lg:col-span-4">
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-5">{t.footerContact}</h4>
            <ul className="space-y-3 text-sm text-white/60">
              {company.phone && <li><a href={`tel:${company.phone}`} className="hover:text-white transition-colors">{company.phone}</a></li>}
              {company.email && <li><a href={`mailto:${company.email}`} className="hover:text-white transition-colors">{company.email}</a></li>}
              {waNumber && <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp</a></li>}
              {company.city && <li className="text-white/45">{company.city}</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-6">
          <p className="max-w-[1500px] mx-auto px-6 lg:px-10 text-[11px] text-white/35">© {new Date().getFullYear()} {company.name}. {t.rights}</p>
        </div>
      </footer>
    </div>
  )
}
