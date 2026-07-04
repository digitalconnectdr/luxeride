// ── Plantilla de micrositio: "Bold" (elegante, oscuro cálido + acento de marca) ─
// Mismo DATA que Noir/Ivory/Corporate, distinto diseño. Estructura tipo landing
// premium de alquiler de autos de lujo: hero oscuro con foto inset + barra de
// acciones flotante → categorías → flota destacada → barra de confianza →
// testimonios → banner de beneficios con checklist → CTA final → footer.
// Server component (sin hooks); usa clientes (LanguageSwitcher/Reveal/Reviews)
// sin problema.

import Image from 'next/image'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ReviewsCarousel } from '@/components/booking/reviews-carousel'
import { CategoryIcon } from '@/components/booking/vehicle-category-icons'
import { PaymentMethodsMarquee } from '@/components/booking/payment-methods-marquee'
import { resolveServiceFallbackImage } from '@/lib/booking/service-fallback-images'
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


// Paleta fija de la plantilla (identidad propia, no depende del brandColor del
// operador — el acento de marca se usa SOLO para highlights/CTA/icons).
const INK = '#14120f'
const CREAM = '#f7f4ee'

const WA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
)
const PaxIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const Check = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const PhoneIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
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
  acceptsCardOnline: boolean
}) {
  const { company, logoUrl, tagline, about, heroImg, brandColor, services, fleet, t, locale, reservarUrl, waNumber, qrDataUrl, reviews, acceptsCardOnline } = props

  const heading = (eyebrow: string, title: string, sub?: string, dark = false) => (
    <Reveal className="mb-12 lg:mb-14 max-w-2xl">
      <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] mb-4" style={{ color: brandColor }}>
        <span className="h-px w-7" style={{ backgroundColor: brandColor }} />{eyebrow}
      </p>
      <h2 className={`font-playfair text-[2rem] sm:text-4xl lg:text-[2.6rem] font-medium tracking-[-0.01em] ${dark ? 'text-white' : 'text-[#171512]'}`}>{title}</h2>
      {sub && <p className={`mt-4 text-[15px] leading-relaxed ${dark ? 'text-white/65' : 'text-[#5b554b]'}`}>{sub}</p>}
    </Reveal>
  )

  const placeholder = (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#efeae0] to-[#ddd4c4]">
      <span className="font-playfair text-2xl text-[#bcae93]">{company.name.charAt(0)}</span>
    </div>
  )

  return (
    <div className="antialiased selection:bg-[var(--brand)]/25" style={{ backgroundColor: CREAM, color: '#171512', ['--brand' as string]: brandColor }}>
      {/* Header */}
      <header id="top" className="sticky top-0 z-40" style={{ backgroundColor: INK }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between text-white">
          <a href="#top" className="flex items-center gap-3 min-w-0">
            {logoUrl && (
              <span className="h-9 w-9 rounded-lg bg-white flex items-center justify-center shrink-0 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={company.name} className="max-h-full max-w-full object-contain" />
              </span>
            )}
            <span className="font-playfair text-xl sm:text-[1.4rem] font-medium tracking-[0.01em] truncate">{company.name}</span>
          </a>
          <nav className="flex items-center gap-5 sm:gap-7 text-[13px] text-white/65">
            {fleet.length > 0 && <a href="#categorias" className="hidden md:inline-block hover:text-white transition-colors">{t.browseCategory}</a>}
            {fleet.length > 0 && <a href="#flota" className="hidden md:inline-block hover:text-white transition-colors">{t.ourFleet}</a>}
            {services.length > 0 && <a href="#servicios" className="hidden lg:inline-block hover:text-white transition-colors">{t.ourServices}</a>}
            {company.phone && (
              <a href={`tel:${company.phone}`} className="hidden lg:inline-flex items-center gap-1.5 hover:text-white transition-colors">
                <span style={{ color: brandColor }}>{PhoneIcon}</span> {company.phone}
              </a>
            )}
            <LanguageSwitcher current={locale} variant="dark" />
            <a href={reservarUrl} className="px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-transform hover:scale-[1.04]" style={{ backgroundColor: brandColor, color: INK }}>{t.bookNow}</a>
          </nav>
        </div>
      </header>

      {/* HERO — oscuro con foto inset + eyebrow/titular en dos tonos */}
      <section className="relative isolate overflow-hidden pb-24 lg:pb-28" style={{ backgroundColor: INK }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-16 lg:pt-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <Reveal>
            <p className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.32em] text-white/55 mb-6">
              <span className="h-px w-8" style={{ backgroundColor: brandColor }} />
              {company.city || 'Drive excellence'}
            </p>
            <h1 className="font-playfair text-[2.6rem] sm:text-5xl lg:text-[3.6rem] font-medium leading-[1.08] tracking-[-0.015em] text-balance text-white">
              {tagline || company.name}
            </h1>
            {about && <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-lg line-clamp-3">{about}</p>}
            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
              <a href={reservarUrl} className="px-8 py-4 rounded-full text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor, color: INK }}>{t.bookNow} →</a>
              {fleet.length > 0 && (
                <a href="#flota" className="px-7 py-4 rounded-full text-sm font-medium border border-white/25 text-white/85 hover:border-white/50 hover:text-white transition-colors">{t.viewFleet}</a>
              )}
            </div>
          </Reveal>
          <Reveal className="relative h-[18rem] sm:h-[24rem] lg:h-[28rem] rounded-[1.5rem] overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/40">
            <Image src={heroImg} alt="" fill priority sizes="(max-width:1024px) 100vw, 46vw" className="object-cover animate-kenburns" />
          </Reveal>
        </div>

        {/* Barra de acciones flotante — a caballo entre el hero y la siguiente sección */}
        <div className="relative z-10 max-w-[1100px] mx-auto px-6 lg:px-10 mt-14 lg:mt-16">
          <Reveal className="rounded-2xl bg-white shadow-2xl shadow-black/25 px-6 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: brandColor }}>{t.bookTitle}</p>
              <p className="text-[#48443c] text-sm mt-1">{t.bookCta}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {waNumber && (
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-black/12 text-sm font-medium text-[#171512] hover:border-black/25 transition-colors">
                  <span className="text-[#25D366]">{WA}</span> WhatsApp
                </a>
              )}
              {company.phone && (
                <a href={`tel:${company.phone}`} className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-black/12 text-sm font-medium text-[#171512] hover:border-black/25 transition-colors">
                  <span style={{ color: brandColor }}>{PhoneIcon}</span> {company.phone}
                </a>
              )}
              <a href={reservarUrl} className="px-6 py-3 rounded-full text-sm font-semibold" style={{ backgroundColor: brandColor, color: INK }}>{t.bookNow} →</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* EXPLORA POR CATEGORÍA */}
      {fleet.length > 0 && (
        <section id="categorias" className="pt-24 lg:pt-28 pb-20">
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
                    <p className="text-sm font-semibold text-[#171512] tracking-wide">{c.label}</p>
                    <p className="text-xs text-[#9c9587] mt-1">{c.sub}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>
      )}

      {/* FLOTA DESTACADA */}
      {fleet.length > 0 && (
        <section id="flota" className="pb-24 lg:pb-28">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
            {heading(t.ourFleet, t.popularFleet, t.popularFleetSub)}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {fleet.map((v, i) => (
                <Reveal key={v.id}>
                  <article className="group rounded-2xl overflow-hidden bg-white ring-1 ring-black/[0.06] shadow-sm hover:shadow-xl hover:shadow-black/[0.08] transition-shadow h-full flex flex-col">
                    <div className="relative h-52 overflow-hidden">
                      {v.base_image_url
                        ? <Image src={v.base_image_url} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover transition-transform duration-[1.1s] ease-out group-hover:scale-105" />
                        : placeholder}
                      {i === 0 && (
                        <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide" style={{ backgroundColor: brandColor, color: INK }}>★ {classLabel(v.class)}</span>
                      )}
                      {i !== 0 && (
                        <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur text-[11px] font-semibold tracking-wide text-[#3a352d] ring-1 ring-black/5">{classLabel(v.class)}</span>
                      )}
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
                        <a href={reservarUrl} className="px-5 py-2.5 rounded-full text-white text-xs font-semibold tracking-wide transition-transform hover:scale-[1.05]" style={{ backgroundColor: brandColor, color: INK }}>{t.bookNow}</a>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BARRA DE CONFIANZA — íconos en círculo + rating */}
      {(t.features.length > 0 || reviews.rating != null) && (
        <section style={{ backgroundColor: INK }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 text-white">
            {t.features.slice(0, reviews.rating != null ? 3 : 4).map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <span className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}22` }}>
                  <Check color={brandColor} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-white/50 mt-1 leading-relaxed line-clamp-2">{f.desc}</p>
                </div>
              </div>
            ))}
            {reviews.rating != null && (
              <div className="flex items-center gap-3">
                <span className="font-playfair text-4xl font-medium" style={{ color: brandColor }}>{reviews.rating.toFixed(1)}</span>
                <div>
                  <span className="tracking-tight text-lg" style={{ color: brandColor }}>★★★★★</span>
                  {reviews.total != null && <p className="text-xs text-white/50 mt-0.5">{reviews.total} {t.reviewsOnGoogle}</p>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SERVICIOS (alternados) */}
      {services.length > 0 && (
        <section id="servicios" className="py-24 lg:py-28">
          <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
            {heading(t.ourServices, t.ourServices)}
            <div className="space-y-16 lg:space-y-20">
              {services.map((s, i) => (
                <Reveal key={s.id}>
                  <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
                    <div className={`relative h-64 lg:h-[22rem] rounded-2xl overflow-hidden ring-1 ring-black/10 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                      <Image src={s.image_url || resolveServiceFallbackImage(s.title)} alt={s.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
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

      {/* TESTIMONIOS */}
      {reviews.reviews.length > 0 && (
        <ReviewsCarousel reviews={reviews.reviews} rating={reviews.rating} total={reviews.total} title={t.reviewsTitle} reviewsLabel={t.reviewsOnGoogle} brandColor={brandColor} variant="bold" />
      )}

      {/* BANNER DE BENEFICIOS — checklist + foto (oscuro) */}
      <section style={{ backgroundColor: INK }} className="text-white">
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 py-20 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <span className="block h-px w-12 mb-6" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
            <h2 className="font-playfair text-[2rem] sm:text-4xl font-medium tracking-[-0.015em] leading-[1.1]">{t.membershipTitle}</h2>
            <p className="mt-5 text-white/60 leading-relaxed max-w-md">{t.membershipText}</p>
            <ul className="mt-8 space-y-3.5">
              {t.features.map((f) => (
                <li key={f.title} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}22` }}><Check color={brandColor} /></span>
                  {f.title}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href={reservarUrl} className="px-8 py-4 rounded-full text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor, color: INK }}>{t.bookNow} →</a>
              {company.phone && <a href={`tel:${company.phone}`} className="text-sm font-medium text-white/70 hover:text-white transition-colors">{t.call}: {company.phone}</a>}
            </div>
          </Reveal>
          <Reveal className="relative h-64 sm:h-80 lg:h-full lg:min-h-[22rem] rounded-2xl overflow-hidden ring-1 ring-white/10">
            <Image src={heroImg} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </Reveal>
        </div>
      </section>

      {/* RESERVA DESDE EL MÓVIL (QR) */}
      <section className="py-20 lg:py-24">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="block h-px w-12 mb-6" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
            <h2 className="font-playfair text-3xl sm:text-4xl font-medium tracking-[-0.01em]">{t.scanTitle}</h2>
            <p className="mt-3 text-[#5b554b] leading-relaxed max-w-md">{t.scanDesc}</p>
            <a href={reservarUrl} className="inline-block mt-8 px-8 py-4 rounded-full text-white text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03]" style={{ backgroundColor: brandColor, color: INK }}>{t.bookNow} →</a>
          </Reveal>
          <Reveal className="flex justify-center lg:justify-end">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10 shadow-xl shadow-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR" width={180} height={180} className="rounded-lg" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Formas de pago — cinta con desplazamiento lateral */}
      <section className="py-20 lg:py-24" style={{ backgroundColor: INK }}>
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
          <PaymentMethodsMarquee acceptsCardOnline={acceptsCardOnline} t={t} tone="dark" brandColor={brandColor} />
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ backgroundColor: INK }} className="text-white/70">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <span className="h-9 w-9 rounded-lg bg-white flex items-center justify-center p-1 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt={company.name} className="max-h-full max-w-full object-contain" />
                </span>
              )}
              <span className="font-playfair text-[1.5rem] font-medium tracking-[0.01em] text-white">{company.name}</span>
            </div>
            {tagline && <p className="mt-5 text-sm text-white/40 max-w-sm leading-relaxed">{tagline}</p>}
            <div className="mt-7 flex items-center gap-3">
              {company.phone && (
                <a href={`tel:${company.phone}`} aria-label={t.call} className="h-9 w-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: brandColor }}>{PhoneIcon}</a>
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
            <h4 className="text-[11px] uppercase tracking-[0.28em] text-white/35 mb-5">{t.footerExplore}</h4>
            <ul className="space-y-3 text-sm text-white/60">
              {fleet.length > 0 && <li><a href="#flota" className="hover:text-white transition-colors">{t.ourFleet}</a></li>}
              {services.length > 0 && <li><a href="#servicios" className="hover:text-white transition-colors">{t.ourServices}</a></li>}
              <li><a href={reservarUrl} className="hover:text-white transition-colors">{t.bookNow}</a></li>
            </ul>
          </div>
          <div className="lg:col-span-4">
            <h4 className="text-[11px] uppercase tracking-[0.28em] text-white/35 mb-5">{t.footerContact}</h4>
            <ul className="space-y-3 text-sm text-white/60">
              {company.phone && <li><a href={`tel:${company.phone}`} className="hover:text-white transition-colors">{company.phone}</a></li>}
              {company.email && <li><a href={`mailto:${company.email}`} className="hover:text-white transition-colors">{company.email}</a></li>}
              {waNumber && <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp</a></li>}
              {company.city && <li className="text-white/40">{company.city}</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/[0.08] py-6">
          <p className="max-w-[1400px] mx-auto px-6 lg:px-10 text-[11px] text-white/30">© {new Date().getFullYear()} {company.name}. {t.rights}</p>
        </div>
      </footer>
    </div>
  )
}
