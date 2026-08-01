// ── Plantilla de micrositio: "Corporate" (blanco/grafito, minimalista SaaS) ───
// Mismo DATA que Noir/Ivory/Bold, distinto diseño. Pensada para cuentas
// corporativas y clientes B2B: sin fotos a sangre ni bloques oscuros, tarjetas
// con borde fino, un solo acento de color usado con moderación, tipografía
// sans contenida. Server component (sin hooks); usa clientes (LanguageSwitcher/
// Reveal/Reviews) sin problema.

import Image from 'next/image'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ReviewsCarousel } from '@/components/booking/reviews-carousel'
import { CategoryIcon } from '@/components/booking/vehicle-category-icons'
import { visibleCategoryIndices } from '@/lib/booking/vehicle-categories'
import { PaymentMethodsMarquee } from '@/components/booking/payment-methods-marquee'
import { ShareMenu } from '@/components/share/share-menu'
import { VerifiedBadge } from '@/components/booking/verified-badge'
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


const WA = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
)
const PaxIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const Check = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export function MicrositeCorporate(props: {
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
  shareUrl: string
  isVerified: boolean
}) {
  const { company, logoUrl, tagline, about, heroImg, brandColor, services, fleet, t, locale, reservarUrl, waNumber, qrDataUrl, reviews, acceptsCardOnline, shareUrl, isVerified } = props
  const visibleCategories = visibleCategoryIndices(fleet.map((v) => v.class))

  const heading = (eyebrow: string, title: string, sub?: string) => (
    <Reveal className="mb-12 max-w-xl">
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: brandColor }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColor }} />{eyebrow}
      </p>
      <h2 className="font-sans text-[1.75rem] sm:text-3xl lg:text-[2.15rem] font-semibold tracking-[-0.01em] text-[#161a1f]">{title}</h2>
      {sub && <p className="mt-3 text-[#6b7280] text-[15px] leading-relaxed">{sub}</p>}
    </Reveal>
  )

  const placeholder = (
    <div className="absolute inset-0 flex items-center justify-center bg-[#f3f4f6]">
      <span className="font-sans font-bold text-3xl text-[#d1d5db]">{company.name.charAt(0)}</span>
    </div>
  )

  return (
    <div className="bg-white text-[#161a1f] antialiased font-sans selection:bg-[var(--brand)]/20" style={{ ['--brand' as string]: brandColor }}>
      {/* Header */}
      <header id="top" className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-black/[0.07]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 min-w-0">
            {logoUrl && (
              <span className="h-8 w-8 rounded-md bg-[#f3f4f6] ring-1 ring-black/5 flex items-center justify-center shrink-0 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={company.name} className="max-h-full max-w-full object-contain" />
              </span>
            )}
            <span className="font-sans text-[15px] font-semibold tracking-[-0.005em] truncate">{company.name}</span>
          </a>
          <nav className="flex items-center gap-6 sm:gap-7 text-[13px] font-medium text-[#42484f]">
            {fleet.length > 0 && <a href="#categorias" className="hidden md:inline-block hover:text-[#161a1f] transition-colors">{t.browseCategory}</a>}
            {fleet.length > 0 && <a href="#flota" className="hidden md:inline-block hover:text-[#161a1f] transition-colors">{t.ourFleet}</a>}
            {services.length > 0 && <a href="#servicios" className="hidden lg:inline-block hover:text-[#161a1f] transition-colors">{t.ourServices}</a>}
            <a href="/auth/login" className="hover:text-[#161a1f] transition-colors">{t.signIn}</a>
            <LanguageSwitcher current={locale} variant="light" />
            <ShareMenu
              url={shareUrl}
              title={company.name}
              variant="light"
              labels={{ share: t.share, copyLink: t.copyLink, copied: t.copied, instagramHint: t.instagramHint }}
            />
            <a href={reservarUrl} className="px-4 py-2 rounded-md text-white font-semibold text-[13px] transition-opacity hover:opacity-90" style={{ backgroundColor: brandColor }}>{t.bookNow}</a>
          </nav>
        </div>
      </header>

      {/* HERO — dos columnas, sin foto a sangre ni degradado oscuro */}
      <section className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-16 lg:pt-20 pb-20 grid lg:grid-cols-[1fr_0.95fr] gap-12 lg:gap-16 items-center">
        <Reveal>
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] mb-6 px-3 py-1.5 rounded-full" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
            {company.city || 'Premium chauffeur service'}
          </p>
          <h1 className="font-sans text-[2.4rem] sm:text-5xl lg:text-[3.4rem] font-semibold leading-[1.08] tracking-[-0.02em] text-balance">
            {tagline || company.name}
          </h1>
          {about && <p className="mt-6 text-[17px] text-[#42484f] leading-relaxed max-w-lg line-clamp-3">{about}</p>}
          <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-3">
            <a href={reservarUrl} className="px-6 py-3.5 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
            {fleet.length > 0 && (
              <a href="#flota" className="px-6 py-3.5 rounded-lg text-sm font-semibold border border-black/[0.12] text-[#161a1f] hover:bg-black/[0.02] transition-colors">{t.viewFleet}</a>
            )}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#6b7280]">
            {waNumber && (
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[#161a1f] transition-colors">
                <span className="text-[#25D366]">{WA}</span> WhatsApp
              </a>
            )}
            {company.phone && <a href={`tel:${company.phone}`} className="hover:text-[#161a1f] transition-colors">{t.call}: {company.phone}</a>}
          </div>
        </Reveal>
        <Reveal className="relative h-[18rem] sm:h-[24rem] lg:h-[28rem] rounded-2xl overflow-hidden ring-1 ring-black/[0.07] shadow-lg shadow-black/[0.06]">
          <Image src={heroImg} alt="" fill priority sizes="(max-width:1024px) 100vw, 46vw" className="object-cover animate-kenburns" />
        </Reveal>
      </section>

      {/* BARRA DE CONFIANZA — fila fina, sin bloque de color contundente */}
      {(t.features.length > 0 || reviews.rating != null || isVerified) && (
        <section className="border-y border-black/[0.07] bg-[#fafafb]">
          <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-6 flex flex-wrap items-center gap-x-10 gap-y-4">
            {isVerified && <VerifiedBadge label={t.verifiedBadgeLabel} tooltip={t.verifiedBadgeTooltip} variant="light" />}
            {t.features.slice(0, reviews.rating != null ? 3 : 4).map((f) => (
              <span key={f.title} className="flex items-center gap-2.5 text-sm text-[#42484f]">
                <Check color={brandColor} />
                <span className="font-medium text-[#161a1f]">{f.title}</span>
              </span>
            ))}
            {reviews.rating != null && (
              <span className="flex items-center gap-2 text-sm">
                <span className="font-semibold" style={{ color: brandColor }}>{reviews.rating.toFixed(1)} ★</span>
                {reviews.total != null && <span className="text-[#6b7280]">· {reviews.total} {t.reviewsOnGoogle}</span>}
              </span>
            )}
          </div>
        </section>
      )}

      {/* EXPLORA POR CATEGORÍA — fila compacta de etiquetas, filtrada contra
          las clases reales de la flota (ver lib/booking/vehicle-categories.ts) */}
      {visibleCategories.length > 0 && (
        <section id="categorias" className="py-20">
          <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
            {heading(t.browseCategory, t.categoryTitle)}
            <RevealStagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {visibleCategories.map((i) => {
                const c = t.categories[i]
                return (
                <RevealItem key={c.label}>
                  <div className="flex flex-col items-start gap-3 rounded-xl border border-black/[0.08] p-4 h-full hover:border-black/20 hover:shadow-sm transition-all">
                    <span
                      className="lux-breathe-soft h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${brandColor}14`, animationDelay: `${i * 0.3}s` }}
                    >
                      <span className="h-5 w-7 flex items-center justify-center" style={{ color: brandColor }}>
                        <CategoryIcon index={i} />
                      </span>
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#161a1f]">{c.label}</p>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">{c.sub}</p>
                    </div>
                  </div>
                </RevealItem>
                )
              })}
            </RevealStagger>
          </div>
        </section>
      )}

      {/* FLOTA — grid de tarjetas limpias tipo catálogo */}
      {fleet.length > 0 && (
        <section id="flota" className="py-20 bg-[#fafafb]">
          <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
            {heading(t.ourFleet, t.popularFleet, t.popularFleetSub)}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {fleet.map((v) => (
                <Reveal key={v.id}>
                  <article className="group rounded-xl overflow-hidden bg-white border border-black/[0.08] hover:shadow-md hover:shadow-black/[0.05] transition-shadow h-full flex flex-col">
                    <div className="relative h-44 overflow-hidden">
                      {v.base_image_url ? <Image src={v.base_image_url} alt={v.name} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" /> : placeholder}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[15px] font-semibold text-[#161a1f]">{v.name}</h3>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}>{classLabel(v.class)}</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[#6b7280]">
                        <span className="inline-flex items-center gap-1.5">{PaxIcon} {v.capacity} {t.pax}</span>
                        {(v.amenities ?? []).slice(0, 2).map((a) => <span key={a}>· {a}</span>)}
                      </div>
                      <div className="mt-5 pt-4 border-t border-black/[0.06] flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[#6b7280]">{t.quoteOnRequest}</span>
                        <a href={reservarUrl} className="px-4 py-2 rounded-md text-white text-[12px] font-semibold" style={{ backgroundColor: brandColor }}>{t.bookNow}</a>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SERVICIOS — grid de tarjetas con foto pequeña (feature-grid estilo SaaS) */}
      {services.length > 0 && (
        <section id="servicios" className="py-20">
          <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
            {heading(t.ourServices, t.ourServices)}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((s, i) => (
                <Reveal key={s.id}>
                  <article className="group rounded-xl overflow-hidden bg-white border border-black/[0.08] hover:shadow-md hover:shadow-black/[0.05] transition-shadow h-full flex flex-col">
                    <div className="relative h-36 overflow-hidden">
                      <Image src={s.image_url || resolveServiceFallbackImage(s.title, i)} alt={s.title} fill sizes="(max-width:1024px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-[15px] font-semibold text-[#161a1f]">{s.title}</h3>
                      {s.description && <p className="text-[13px] text-[#6b7280] leading-relaxed mt-2 flex-1">{s.description}</p>}
                      <a href={reservarUrl} className="inline-flex items-center gap-1 mt-4 text-[13px] font-semibold w-fit" style={{ color: brandColor }}>{t.bookNow} →</a>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CÓMO RESERVAR */}
      <section className="py-20 bg-[#fafafb]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          {heading(t.stepsTitle, t.stepsTitle)}
          <div className="grid sm:grid-cols-3 gap-5">
            {t.steps.map((st, i) => (
              <Reveal key={st.title} className="h-full">
                <div className="rounded-xl h-full p-6 bg-white border border-black/[0.08]">
                  <span className="inline-flex h-8 w-8 rounded-lg items-center justify-center text-sm font-bold" style={{ backgroundColor: `${brandColor}14`, color: brandColor }}>{i + 1}</span>
                  <h3 className="text-[15px] font-semibold mt-4">{st.title}</h3>
                  <p className="text-[13px] text-[#6b7280] mt-1.5 leading-relaxed">{st.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      {reviews.reviews.length > 0 && (
        <ReviewsCarousel reviews={reviews.reviews} rating={reviews.rating} total={reviews.total} title={t.reviewsTitle} reviewsLabel={t.reviewsOnGoogle} brandColor={brandColor} variant="corporate" />
      )}

      {/* CTA — franja gris apagada con tarjeta central, sin bloque oscuro */}
      <section className="py-20 bg-[#fafafb]">
        <div className="max-w-[720px] mx-auto px-6 text-center rounded-2xl bg-white border border-black/[0.08] py-14 px-8 shadow-sm shadow-black/[0.04]">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-[-0.01em]">{t.membershipTitle}</h2>
          <p className="mt-3 text-[#6b7280] leading-relaxed max-w-md mx-auto">{t.membershipText}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
            <a href={reservarUrl} className="px-6 py-3.5 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
            {company.phone && <a href={`tel:${company.phone}`} className="px-6 py-3.5 rounded-lg text-sm font-semibold border border-black/[0.12] text-[#161a1f] hover:bg-black/[0.02] transition-colors">{t.call}: {company.phone}</a>}
          </div>
        </div>
      </section>

      {/* RESERVA DESDE EL MÓVIL (QR) */}
      <section className="py-20">
        <div className="max-w-[1000px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-[-0.01em]">{t.scanTitle}</h2>
            <p className="mt-3 text-[#6b7280] leading-relaxed max-w-md">{t.scanDesc}</p>
            <a href={reservarUrl} className="inline-block mt-7 px-6 py-3.5 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: brandColor }}>{t.bookNow} →</a>
          </Reveal>
          <Reveal className="flex justify-center lg:justify-end">
            <div className="rounded-xl bg-white p-4 border border-black/[0.08] shadow-sm shadow-black/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR" width={170} height={170} className="rounded-md" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Formas de pago — cinta con desplazamiento lateral */}
      <section className="py-20 bg-black/[0.02] border-t border-black/[0.06]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <PaymentMethodsMarquee acceptsCardOnline={acceptsCardOnline} t={t} tone="light" brandColor={brandColor} />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/[0.07]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="text-[15px] font-semibold">{company.name}</span>
            {tagline && <p className="text-sm text-[#9ca3af] mt-2 max-w-xs leading-relaxed line-clamp-2">{tagline}</p>}
          </div>
          <div className="lg:col-span-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af] mb-4">{t.footerExplore}</h4>
            <ul className="space-y-2.5 text-sm text-[#42484f]">
              {fleet.length > 0 && <li><a href="#flota" className="hover:text-[#161a1f] transition-colors">{t.ourFleet}</a></li>}
              {services.length > 0 && <li><a href="#servicios" className="hover:text-[#161a1f] transition-colors">{t.ourServices}</a></li>}
              <li><a href={reservarUrl} className="hover:text-[#161a1f] transition-colors">{t.bookNow}</a></li>
            </ul>
          </div>
          <div className="lg:col-span-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af] mb-4">{t.footerContact}</h4>
            <ul className="space-y-2.5 text-sm text-[#42484f]">
              {company.phone && <li><a href={`tel:${company.phone}`} className="hover:text-[#161a1f] transition-colors">{company.phone}</a></li>}
              {company.email && <li><a href={`mailto:${company.email}`} className="hover:text-[#161a1f] transition-colors">{company.email}</a></li>}
              {waNumber && <li><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#161a1f] transition-colors">WhatsApp</a></li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-black/[0.06] py-5">
          <p className="max-w-[1280px] mx-auto px-6 lg:px-10 text-[11px] text-[#9ca3af]">© {new Date().getFullYear()} {company.name}. {t.rights}</p>
        </div>
      </footer>
    </div>
  )
}
