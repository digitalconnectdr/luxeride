// ── Plantilla de micrositio: "Ivory" (claro / editorial — crema + dorado) ─────
// Mismo DATA que la Noir, distinto diseño. Estructura inspirada en landings
// premium del rubro: hero a pantalla completa (texto sobrepuesto, mismo
// tratamiento que Noir) → explora por categoría → flota destacada → barra de
// stats → servicios → pasos → testimonios → CTA membresía → footer.
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

// Etiqueta legible por clase (los valores en BD son enums en minúscula).
const CLASS_LABEL: Record<string, string> = {
  sedan: 'Sedan', suv: 'SUV', van: 'Van', minivan: 'Minivan', suburban: 'Suburban',
  limousine: 'Limousine', limo: 'Limo', sprinter: 'Sprinter', bus: 'Bus', coach: 'Coach',
  exotic: 'Exotic', luxury: 'Luxury', vip: 'VIP',
}
const classLabel = (c: string) => CLASS_LABEL[c] ?? (c.charAt(0).toUpperCase() + c.slice(1))

// Respaldo para SERVICIOS sin foto (no son unidades reales → foto genérica de lujo
// es aceptable). Mismo endpoint Unsplash que la plantilla Noir.
const U = (slug: string) => `https://unsplash.com/photos/${slug}/download?force=true&w=1600`
const SERVICE_DEFAULTS = [U('NjQmytqwDGs'), U('7I8qdKTHDp4'), U('4Dofvf-eUMs'), U('FZ5MkHkeyKM')]

const WA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
)

const Check = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const PaxIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
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

  const heading = (eyebrow: string, title: string, sub?: string) => (
    <Reveal className="mb-12 lg:mb-14 max-w-2xl">
      <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-[#9a948a] mb-4">
        <span className="h-px w-7" style={{ backgroundColor: brandColor }} />{eyebrow}
      </p>
      <h2 className="font-playfair text-[2rem] sm:text-4xl lg:text-[2.7rem] font-medium tracking-[-0.015em] text-[#1d1b18]">{title}</h2>
      {sub && <p className="mt-4 text-[#5b554b] text-[15px] leading-relaxed">{sub}</p>}
    </Reveal>
  )

  const vehiclePlaceholder = (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#efeae0] to-[#ddd4c4]">
      <span className="font-playfair text-2xl text-[#bcae93]">{company.name.charAt(0)}</span>
    </div>
  )

  return (
    <div className="bg-[#f6f3ec] text-[#1d1b18] antialiased selection:bg-[var(--brand)]/20" style={{ ['--brand' as string]: brandColor }}>
      {/* Header */}
      <header id="top" className="sticky top-0 z-40 bg-[#f6f3ec]/90 backdrop-blur-md border-b border-black/[0.06]">
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}66, transparent)` }} />
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3 min-w-0">
            {logoUrl && (
              <span className="h-9 w-9 rounded-lg bg-white ring-1 ring-black/5 flex items-center justify-center shrink-0 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={company.name} className="max-h-full max-w-full object-contain" />
              </span>
            )}
            <span className="font-playfair text-xl sm:text-[1.5rem] font-medium tracking-[0.02em] truncate">{company.name}</span>
          </a>
          <nav className="flex items-center gap-6 sm:gap-8 text-[13px] text-[#5b554b]">
            {fleet.length > 0 && <a href="#categorias" className="hidden md:inline-block hover:text-[#1d1b18] transition-colors">{t.browseCategory}</a>}
            {fleet.length > 0 && <a href="#flota" className="hidden md:inline-block hover:text-[#1d1b18] transition-colors">{t.ourFleet}</a>}
            {services.length > 0 && <a href="#servicios" className="hidden lg:inline-block hover:text-[#1d1b18] transition-colors">{t.ourServices}</a>}
            <LanguageSwitcher current={locale} variant="light" />
            <a href={reservarUrl} className="px-5 py-2 rounded-full text-white font-semibold text-xs tracking-wide transition-transform hover:scale-[1.04]" style={{ backgroundColor: brandColor }}>{t.bookNow}</a>
          </nav>
        </div>
      </header>

      {/* HERO — imagen a sección completa con el texto sobrepuesto (mismo
          tratamiento premium que la plantilla Noir: Ken Burns lento + grano +
          degradado, para que el estilo sea consistente entre ambos diseños). */}
      <section className="lux-grain relative isolate min-h-[92vh] flex items-center overflow-hidden">
        <Image src={heroImg} alt="" fill priority sizes="100vw" className="object-cover -z-10 animate-kenburns" />
        <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(100deg, rgba(23,20,15,0.92) 0%, rgba(23,20,15,0.66) 46%, rgba(23,20,15,0.22) 100%)' }} />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-white to-transparent" />
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 w-full">
          <Reveal className="max-w-2xl">
            <p className="flex items-center gap-3 text-[12px] uppercase tracking-[0.34em] text-white/75 mb-7">
              <span className="h-px w-8" style={{ backgroundColor: brandColor }} />
              {company.city || 'Premium chauffeur service'}
            </p>
            <h1 className="font-playfair text-[2.7rem] sm:text-6xl lg:text-[4.1rem] font-medium leading-[1.04] tracking-[-0.02em] text-balance text-white">
              {tagline || company.name}
            </h1>
            {about && <p className="mt-6 text-lg text-white/75 leading-relaxed max-w-xl line-clamp-3">{about}</p>}
            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a href={reservarUrl} className="px-8 py-4 rounded-full text-[#17140f] text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
              {fleet.length > 0 && (
                <a href="#flota" className="px-7 py-4 rounded-full text-sm font-medium border border-white/30 text-white hover:border-white/55 hover:bg-white/10 transition-colors">{t.viewFleet}</a>
              )}
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-white/85 hover:text-white transition-colors ml-1">
                  <span className="text-[#25D366]">{WA}</span> WhatsApp
                </a>
              )}
              {company.phone && <a href={`tel:${company.phone}`} className="lux-link text-sm font-medium text-white/85 hover:text-white transition-colors">{t.call}</a>}
            </div>
          </Reveal>
        </div>
        {/* Indicador de scroll */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 text-white/40">
          <span className="lux-scroll-cue h-9 w-px" style={{ background: `linear-gradient(${brandColor}, transparent)` }} />
        </div>
      </section>

      {/* EXPLORA POR CATEGORÍA — categorías FIJAS de servicio (marketing, no la
          flota real del operador). Las fotos reales de vehículos van más abajo,
          en "Vehículos más solicitados". */}
      {fleet.length > 0 && (
        <section id="categorias" className="py-20 lg:py-24 bg-white border-y border-black/[0.05]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
            {heading(t.browseCategory, t.categoryTitle)}
            <RevealStagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-12">
              {t.categories.map((c, i) => (
                <RevealItem key={c.label} className="flex flex-col items-center text-center gap-4">
                  <span
                    className="lux-breathe relative h-20 w-20 rounded-full flex items-center justify-center transition-transform duration-500 hover:scale-110"
                    style={{ backgroundColor: `${brandColor}17`, animationDelay: `${i * 0.35}s` }}
                  >
                    <span className="h-9 w-14 flex items-center justify-center" style={{ color: brandColor }}>
                      <CategoryIcon index={i} />
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1b18] tracking-wide">{c.label}</p>
                    <p className="text-xs text-[#9a948a] mt-1">{c.sub}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      )}

      {/* FLOTA DESTACADA */}
      {fleet.length > 0 && (
        <section id="flota" className="py-20 lg:py-28 bg-[#f6f3ec]">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
            {heading(t.ourFleet, t.popularFleet, t.popularFleetSub)}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {fleet.map((v) => (
                <Reveal key={v.id}>
                  <article className="group rounded-[1.4rem] overflow-hidden bg-white ring-1 ring-black/[0.07] shadow-sm hover:shadow-xl hover:shadow-black/[0.07] transition-shadow h-full flex flex-col">
                    <div className="relative h-52 overflow-hidden">
                      {v.base_image_url
                        ? <Image src={v.base_image_url} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover transition-transform duration-[1.1s] ease-out group-hover:scale-105" />
                        : vehiclePlaceholder}
                      <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-[11px] font-semibold tracking-wide text-[#3a352d] ring-1 ring-black/5">{classLabel(v.class)}</span>
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-playfair text-xl font-medium">{v.name}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#75716a]">
                        <span className="inline-flex items-center gap-1.5">{PaxIcon} {v.capacity} {t.pax}</span>
                        {(v.amenities ?? []).slice(0, 2).map((a) => (
                          <span key={a} className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-current opacity-40" />{a}</span>
                        ))}
                      </div>
                      <div className="mt-6 pt-5 border-t border-black/[0.07] flex items-center justify-between">
                        <span className="text-[13px] font-medium" style={{ color: brandColor }}>{t.quoteOnRequest}</span>
                        <a href={reservarUrl} className="px-5 py-2.5 rounded-full text-white text-xs font-semibold tracking-wide transition-transform hover:scale-[1.05]" style={{ backgroundColor: brandColor }}>{t.bookNow}</a>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BARRA DE STATS (oscura) — confianza + rating */}
      {(t.features.length > 0 || reviews.rating != null) && (
        <section className="bg-[#17140f] text-white">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">
            {t.features.slice(0, reviews.rating != null ? 3 : 4).map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <Check color={brandColor} />
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-white/55 mt-1 leading-relaxed line-clamp-2">{f.desc}</p>
                </div>
              </div>
            ))}
            {reviews.rating != null && (
              <div className="flex items-center gap-3">
                <span className="font-playfair text-4xl font-medium" style={{ color: brandColor }}>{reviews.rating.toFixed(1)}</span>
                <div>
                  <span className="tracking-tight text-lg" style={{ color: brandColor }}>★★★★★</span>
                  {reviews.total != null && <p className="text-xs text-white/55 mt-0.5">{reviews.total} {t.reviewsOnGoogle}</p>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SERVICIOS (alternados) */}
      {services.length > 0 && (
        <section id="servicios" className="py-20 lg:py-28 bg-white">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {heading(t.ourServices, t.ourServices)}
            <div className="space-y-16 lg:space-y-20">
              {services.map((s, i) => (
                <Reveal key={s.id}>
                  <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
                    <div className={`relative h-64 lg:h-[22rem] rounded-[1.4rem] overflow-hidden ring-1 ring-black/10 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                      <Image src={s.image_url || SERVICE_DEFAULTS[i % SERVICE_DEFAULTS.length]} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
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

      {/* CÓMO RESERVAR */}
      <section className="py-20 lg:py-28 bg-[#f6f3ec]">
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
          {heading(t.stepsTitle, t.stepsTitle)}
          <div className="grid sm:grid-cols-3 gap-6">
            {t.steps.map((st, i) => (
              <Reveal key={st.title} className="h-full">
                <div className="rounded-[1.4rem] h-full p-7 bg-white ring-1 ring-black/[0.07]">
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

      {/* TESTIMONIOS */}
      {reviews.reviews.length > 0 && (
        <ReviewsCarousel reviews={reviews.reviews} rating={reviews.rating} total={reviews.total} title={t.reviewsTitle} reviewsLabel={t.reviewsOnGoogle} brandColor={brandColor} variant="ivory" />
      )}

      {/* CTA MEMBRESÍA / "¿Listo para elevar tu viaje?" (oscuro) */}
      <section className="relative isolate overflow-hidden bg-[#17140f] text-white">
        <Image src={heroImg} alt="" fill sizes="100vw" className="object-cover -z-10 opacity-25" />
        <div className="absolute inset-0 -z-10 bg-[#17140f]/80" />
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20 lg:py-24 text-center">
          <span className="block h-px w-12 mx-auto mb-7" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />
          <h2 className="font-playfair text-[2.2rem] sm:text-5xl font-medium tracking-[-0.015em] text-balance">{t.membershipTitle}</h2>
          <p className="mt-5 text-white/70 leading-relaxed max-w-xl mx-auto">{t.membershipText}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <a href={reservarUrl} className="px-9 py-4 rounded-full text-[#17140f] text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
            {company.phone && <a href={`tel:${company.phone}`} className="text-sm font-medium text-white/80 hover:text-white transition-colors">{t.call}: {company.phone}</a>}
          </div>
        </div>
      </section>

      {/* RESERVA DESDE EL MÓVIL (QR) */}
      <section className="py-20 lg:py-24 bg-[#f6f3ec]">
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

      {/* FOOTER (oscuro) */}
      <footer className="bg-[#17140f] text-white/70">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <span className="h-9 w-9 rounded-lg bg-white/95 flex items-center justify-center p-1 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt={company.name} className="max-h-full max-w-full object-contain" />
                </span>
              )}
              <span className="font-playfair text-[1.5rem] font-medium tracking-[0.03em] text-white">{company.name}</span>
            </div>
            {tagline && <p className="mt-5 text-sm text-white/45 max-w-sm leading-relaxed">{tagline}</p>}
            <div className="mt-7 flex items-center gap-3">
              {company.phone && (
                <a href={`tel:${company.phone}`} aria-label={t.call} className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: brandColor }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                </a>
              )}
              {company.email && (
                <a href={`mailto:${company.email}`} aria-label="Email" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: brandColor }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </a>
              )}
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-[#25D366]">{WA}</a>
              )}
            </div>
          </div>
          <div className="lg:col-span-3">
            <h4 className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-5">{t.footerExplore}</h4>
            <ul className="space-y-3 text-sm text-white/60">
              {fleet.length > 0 && <li><a href="#flota" className="hover:text-white transition-colors">{t.ourFleet}</a></li>}
              {services.length > 0 && <li><a href="#servicios" className="hover:text-white transition-colors">{t.ourServices}</a></li>}
              <li><a href={reservarUrl} className="hover:text-white transition-colors">{t.bookNow}</a></li>
            </ul>
          </div>
          <div className="lg:col-span-4">
            <h4 className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-5">{t.footerContact}</h4>
            <ul className="space-y-3 text-sm text-white/60">
              {company.phone && <li><a href={`tel:${company.phone}`} className="hover:text-white transition-colors">{company.phone}</a></li>}
              {company.email && <li><a href={`mailto:${company.email}`} className="hover:text-white transition-colors">{company.email}</a></li>}
              {waNumber && <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp</a></li>}
              {company.city && <li className="text-white/45">{company.city}</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.08] py-6">
          <p className="max-w-[1400px] mx-auto px-6 lg:px-10 text-[11px] text-white/35">© {new Date().getFullYear()} {company.name}. {t.rights}</p>
        </div>
      </footer>
    </div>
  )
}
