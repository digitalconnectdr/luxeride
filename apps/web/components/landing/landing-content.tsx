import Link from 'next/link'
import Image from 'next/image'
import { getDict } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'
import { HeroMockup } from '@/components/landing/hero-mockup'
import { PaymentMethodsMarquee } from '@/components/booking/payment-methods-marquee'
import { brand, withBrand } from '@/lib/brand'
import { getAppUrl } from '@/lib/app-url'
import { buildLandingStructuredData } from '@/lib/seo/structured-data'

const SHOWCASE_IMAGES = [
  // Experiencia de reserva | auto deportivo oscuro
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1100&q=70',
  // Dispatch | carretera de noche
  'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1100&q=70',
  // Pagos | sedán negro
  'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1100&q=70',
]

// Flota por clase de vehículo (Unsplash, licencia libre | endpoint estable por slug).
// Para usar fotos propias/oficiales: colocar archivos en public/vehicles/ y
// cambiar estas URLs por '/vehicles/<archivo>.jpg'.
const FLEET_IMAGES = [
  'https://unsplash.com/photos/NjQmytqwDGs/download?force=true&w=900', // Sedán Mercedes negro
  'https://unsplash.com/photos/9XVJ-Jq7Ke8/download?force=true&w=900', // Cadillac Escalade negra
  'https://unsplash.com/photos/4Dofvf-eUMs/download?force=true&w=900', // SUV ejecutiva negra (Suburban)
  'https://unsplash.com/photos/7I8qdKTHDp4/download?force=true&w=900', // Mercedes Sprinter
  'https://unsplash.com/photos/FZ5MkHkeyKM/download?force=true&w=900', // Limusina stretch
]

export function LandingPageContent({
  locale,
  localizedPaths,
}: {
  locale: Locale
  // Presente solo en las páginas dedicadas por idioma (/en, /es, /pt) | le
  // dice al LanguageSwitcher que navegue entre esas URLs en vez de refrescar
  // la página actual, ya que estas ignoran la cookie a propósito (SEO).
  localizedPaths?: Record<Locale, string>
}) {
  const dict = getDict(locale)
  const t = dict.landing

  // Directorio de operadores (marketplace) desactivado | ver sección comentada
  // más abajo. LuxeRide es white-label: el landing solo vende el software.

  const structuredData = buildLandingStructuredData({
    baseUrl: getAppUrl(),
    description: t.metaDescription,
    plans: t.plans,
    faq: t.faq.map((item) => ({ q: item.q, a: withBrand(item.a) })),
  })

  return (
    <div className="min-h-screen bg-[#0c0b0a] text-white antialiased overflow-x-hidden">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0c0b0a]/90 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] flex items-center justify-center shadow-[0_0_18px_rgba(233,193,118,0.35)]">
              <span className="text-[#141313] font-playfair font-bold text-sm leading-none">{brand.name.charAt(0)}</span>
            </div>
            <div className="leading-tight">
              <span className="font-playfair text-lg font-semibold tracking-wide">{brand.name}</span>
              <p className="text-[8px] uppercase tracking-[0.25em] text-white/35">
                by {brand.poweredBy}
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6">
            <a href="#features" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {t.nav.platform}
            </a>
            <a href="#pricing" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {t.nav.pricing}
            </a>
            <a href="#faq" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {t.nav.faq}
            </a>
            <LanguageSwitcher current={locale} variant="dark" localizedPaths={localizedPaths} />
            <Link href="/auth/login" className="hidden sm:block text-[13px] text-white/55 hover:text-white transition-colors">
              {dict.common.signIn}
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 sm:px-5 py-2.5 text-[13px] font-semibold bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] rounded-full hover:opacity-90 transition-opacity"
            >
              {dict.common.signUp}
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 45% at 50% -5%, rgba(233,193,118,0.14), transparent 70%)',
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-16 sm:pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-3 mb-7">
                <span className="h-px w-10 bg-[#e9c176]/60" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176]">
                  {t.hero.badge}
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <h1 className="font-playfair text-4xl sm:text-[3.4rem] leading-[1.1] font-semibold">
                {t.hero.title}
                <span className="block mt-2 italic font-medium bg-gradient-to-r from-[#f3d9a4] via-[#e9c176] to-[#c89b4f] bg-clip-text text-transparent">
                  {t.hero.titleAccent}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-base sm:text-lg text-white/55 mt-6 leading-relaxed max-w-xl">
                {withBrand(t.hero.subtitle)}
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-9">
                <Link
                  href="/auth/signup"
                  className="lux-cta-pulse px-8 py-4 text-sm font-semibold bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] rounded-full hover:opacity-90 transition-opacity"
                >
                  {t.hero.ctaPrimary}
                </Link>
                <a
                  href="#showcase"
                  className="px-8 py-4 text-sm font-semibold border border-white/15 rounded-full hover:border-[#e9c176]/60 hover:text-[#e9c176] transition-colors"
                >
                  {t.hero.ctaSecondary}
                </a>
              </div>
              <p className="text-xs text-white/35 mt-5">{t.hero.note}</p>
            </Reveal>
          </div>

          {/* Mockup animado del producto */}
          <Reveal delay={0.25} className="hidden lg:block">
            <HeroMockup labels={t.mockup} />
          </Reveal>
        </div>

        {/* Stats band */}
        <div className="relative max-w-4xl mx-auto px-6 pb-20">
          <RevealStagger className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
            {t.stats.map((s) => (
              <RevealItem key={s.label} className="bg-[#0c0b0a] px-6 py-6">
                <p className="font-playfair text-3xl font-semibold text-[#e9c176]">{s.value}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1.5">
                  {s.label}
                </p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 py-24">
          <Reveal className="max-w-2xl mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176] mb-4">
              {t.nav.platform}
            </p>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold leading-snug">
              {t.featuresTitle}
            </h2>
            <p className="text-white/45 mt-3 text-sm">{t.featuresSubtitle}</p>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
            {t.features.map((f, i) => (
              <RevealItem
                key={f.title}
                className="group bg-[#0c0b0a] p-8 hover:bg-[#13110e] transition-colors"
              >
                <p className="font-playfair text-sm text-[#e9c176]/70 group-hover:text-[#e9c176] transition-colors">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="font-playfair text-lg font-semibold mt-4 mb-3">{f.title}</h3>
                <p className="text-[13px] text-white/45 leading-relaxed">{f.desc}</p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Showcase: filas alternadas con fotografía ── */}
      <section id="showcase" className="border-t border-white/[0.06] bg-[#0a0908]">
        <div className="max-w-[1400px] mx-auto px-6 py-24 space-y-24">
          {t.showcase.map((row, i) => (
            <div
              key={row.title}
              className={`grid lg:grid-cols-2 gap-12 items-center ${
                i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              <Reveal>
                <div className="relative h-72 sm:h-80 rounded-3xl overflow-hidden border border-white/[0.08]">
                  <Image
                    src={SHOWCASE_IMAGES[i] ?? SHOWCASE_IMAGES[0]!}
                    alt={row.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0908]/80 via-transparent to-[#0a0908]/20" />
                  <div className="absolute bottom-4 left-5">
                    <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#e9c176]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e9c176]" />
                      {brand.name}
                    </span>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.15}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176] mb-4">
                  {row.kicker}
                </p>
                <h3 className="font-playfair text-2xl sm:text-3xl font-semibold leading-snug mb-3">
                  {row.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed mb-6 max-w-md">{row.desc}</p>
                <ul className="space-y-4">
                  {row.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#e9c176]/15 text-[#e9c176] text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span className="text-sm text-white/65 leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ── Flota por clase de vehículo ── */}
      <section id="fleet" className="border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 py-24">
          <Reveal className="text-center mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176] mb-4">
              {t.fleet.kicker}
            </p>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.fleet.title}</h2>
            <p className="text-white/45 mt-3 text-sm max-w-xl mx-auto">{t.fleet.subtitle}</p>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.fleet.vehicles.map((v, i) => (
              <RevealItem key={v.name}>
                <div className="group relative h-56 rounded-3xl overflow-hidden border border-white/[0.08] hover:border-[#e9c176]/50 transition-colors">
                  <Image
                    src={FLEET_IMAGES[i] ?? FLEET_IMAGES[0]!}
                    alt={v.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c0b0a]/95 via-[#0c0b0a]/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="font-playfair text-lg font-semibold">{v.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#e9c176] mt-1">
                      {v.capacity}
                    </p>
                  </div>
                </div>
              </RevealItem>
            ))}

            {/* Card CTA: tu flota aquí */}
            <RevealItem>
              <Link
                href="/auth/signup"
                className="group flex flex-col items-center justify-center h-56 rounded-3xl border border-dashed border-[#e9c176]/40 hover:border-[#e9c176] hover:bg-[#e9c176]/[0.04] transition-all text-center px-8"
              >
                <span className="w-12 h-12 rounded-full border border-[#e9c176]/50 flex items-center justify-center text-[#e9c176] text-2xl mb-4 group-hover:scale-110 transition-transform">
                  +
                </span>
                <p className="font-playfair text-lg font-semibold text-[#e9c176]">
                  {t.fleet.ctaCard.title}
                </p>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">{t.fleet.ctaCard.desc}</p>
              </Link>
            </RevealItem>
          </RevealStagger>
        </div>
      </section>

      {/* ── Statement ── */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <Reveal>
            <p className="font-playfair text-3xl sm:text-4xl lg:text-[2.75rem] font-medium leading-tight tracking-[-0.01em] text-balance">
              <span>{t.statement.line1}</span>{' '}
              <span className="text-[#e9c176]">{t.statement.line2}</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Escenarios de operación ── */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 py-24">
          <Reveal className="text-center mb-14">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">
              {t.scenariosTitle}
            </h2>
          </Reveal>
          <RevealStagger className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {t.scenarios.map((sc) => (
              <RevealItem
                key={sc.tag}
                className="bg-white/[0.025] border border-white/[0.08] rounded-3xl p-8 flex flex-col"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e9c176] mb-4">
                  {sc.tag}
                </p>
                <p className="text-sm text-white/70 leading-relaxed flex-1">{sc.text}</p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Confianza operativa ── */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <Reveal className="text-center mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176] mb-4">
              {t.trust.kicker}
            </p>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold leading-snug text-balance">
              {t.trust.title}
            </h2>
            <p className="text-white/50 mt-4 text-sm max-w-2xl mx-auto leading-relaxed">
              {withBrand(t.trust.desc)}
            </p>
          </Reveal>
          <Reveal className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-8 sm:px-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
              {t.trust.points.map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="text-[#e9c176] text-base mt-0.5 shrink-0">✓</span>
                  <span className="text-[15px] text-white/80 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Programa de referidos ── */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <Reveal className="text-center mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176] mb-4">
              {t.referralProgram.kicker}
            </p>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold leading-snug text-balance">
              {t.referralProgram.title}
            </h2>
            <p className="text-white/50 mt-4 text-sm max-w-2xl mx-auto leading-relaxed">
              {withBrand(t.referralProgram.desc)}
            </p>
          </Reveal>
          <Reveal className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-8 sm:px-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
              {t.referralProgram.points.map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="text-[#e9c176] text-base mt-0.5 shrink-0">✓</span>
                  <span className="text-[15px] text-white/80 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="border-t border-white/[0.06] bg-[#0a0908] relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 50% 50% at 50% 0%, rgba(233,193,118,0.07), transparent 70%)',
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-6 py-24">
          <Reveal className="text-center mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176] mb-4">
              {t.nav.pricing}
            </p>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.pricingTitle}</h2>
            <p className="text-white/45 mt-3 text-sm">{t.pricingSubtitle}</p>
            <p className="inline-flex items-center gap-2 mt-5 px-4 py-1.5 rounded-full bg-[#e9c176]/10 border border-[#e9c176]/30 text-sm font-semibold text-[#e9c176]">
              {t.pricingNoSetupBadge}
            </p>
          </Reveal>

          <Reveal className="max-w-4xl mx-auto mb-14 rounded-2xl border border-[#e9c176]/20 bg-gradient-to-b from-[#e9c176]/[0.06] to-transparent px-6 py-8 sm:px-10">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#e9c176] mb-6">
              {t.pricingIncludedTitle}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
              {t.pricingIncluded.map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="text-[#e9c176] text-base mt-0.5 shrink-0">✓</span>
                  <span className="text-[15px] text-white/80 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {t.plans.map((plan, i) => {
              const popular = i === 1
              const isLast = i === t.plans.length - 1
              return (
                <RevealItem
                  key={plan.name}
                  className={`relative rounded-3xl p-8 flex flex-col ${
                    popular
                      ? 'bg-gradient-to-b from-[#1a1712] to-[#12100d] border-2 border-[#e9c176]/60 shadow-[0_0_50px_rgba(233,193,118,0.12)]'
                      : 'bg-white/[0.025] border border-white/[0.08]'
                  }`}
                >
                  {popular && (
                    <span className="lux-badge-pulse absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] rounded-full">
                      {t.pricingPopular}
                    </span>
                  )}
                  <h3 className="font-playfair text-xl font-semibold">{plan.name}</h3>
                  <p className="text-xs text-white/45 mt-2 leading-relaxed">{plan.desc}</p>
                  <p className="mt-6 mb-7">
                    <span className="font-playfair text-4xl font-semibold text-[#e9c176]">
                      {plan.price}
                    </span>
                    <span className="text-sm text-white/40 ml-1">{plan.period}</span>
                  </p>
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className="text-[#e9c176] text-xs mt-0.5 shrink-0">✓</span>
                        <span className="text-[13px] text-white/60 leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth/signup"
                    className={`mt-8 block text-center px-6 py-3.5 text-sm font-semibold rounded-full transition-all ${
                      popular
                        ? 'lux-cta-pulse bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] hover:opacity-90'
                        : 'border border-white/20 hover:border-[#e9c176]/60 hover:text-[#e9c176]'
                    }`}
                  >
                    {isLast ? t.pricingContact : t.pricingCta}
                  </Link>
                </RevealItem>
              )
            })}
          </RevealStagger>
          <p className="text-center text-sm text-white/55 mt-10 max-w-2xl mx-auto">{t.pricingFooterNote}</p>
        </div>
      </section>

      {/* ── Formas de pago | cinta con desplazamiento lateral ── */}
      <section className="border-t border-white/[0.06] py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <PaymentMethodsMarquee acceptsCardOnline t={t} tone="dark" />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <Reveal className="text-center mb-12">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.faqTitle}</h2>
          </Reveal>
          <RevealStagger className="space-y-3">
            {t.faq.map((item) => (
              <RevealItem key={item.q}>
                <details className="group bg-white/[0.025] border border-white/[0.08] rounded-2xl open:border-[#e9c176]/40 transition-colors">
                  <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none">
                    <span className="text-sm font-semibold">{item.q}</span>
                    <span className="text-[#e9c176] text-lg leading-none transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="px-6 pb-5 text-sm text-white/55 leading-relaxed">{withBrand(item.a)}</p>
                </details>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Directorio de reservas (marketplace) ─────────────────────────────
          DESACTIVADO 2026-06-14 | decisión de negocio: LuxeRide es white-label
          puro; el landing solo vende el software. Cada operador usa su propio
          link /book/su-slug. Para reactivar el modelo marketplace, descomentar
          esta sección, el link "#book" del nav y el query `companies` arriba.

      <section id="book" className="border-t border-white/[0.06] bg-[#0a0908]">
        <div className="max-w-[1200px] mx-auto px-6 py-24 text-center">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176] mb-4">
              {t.nav.book}
            </p>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold mb-4">
              {t.directoryTitle}
            </h2>
            <p className="text-white/45 mb-12 max-w-xl mx-auto text-sm leading-relaxed">
              {t.directorySubtitle}
            </p>
          </Reveal>
          {!companies?.length ? (
            <p className="text-sm text-white/35">{t.directoryEmpty}</p>
          ) : (
            <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((c) => (
                <RevealItem key={c.slug}>
                  <Link
                    href={`/book/${c.slug}`}
                    className="group block bg-white/[0.025] border border-white/[0.08] rounded-2xl px-7 py-6 hover:border-[#e9c176]/50 hover:bg-white/[0.04] transition-all text-left"
                  >
                    <p className="font-playfair font-semibold text-base">{c.name}</p>
                    <p className="text-xs text-white/35 mt-2 group-hover:text-[#e9c176] transition-colors">
                      {c.city ? `${c.city} · ` : ''}{t.directoryBook}
                    </p>
                  </Link>
                </RevealItem>
              ))}
            </RevealStagger>
          )}
        </div>
      </section>
      ──────────────────────────────────────────────────────────────────────── */}

      {/* ── CTA final ── */}
      <section className="border-t border-white/[0.06] relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 70% at 50% 110%, rgba(233,193,118,0.12), transparent 70%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6 py-28 text-center">
          <Reveal>
            <h2 className="font-playfair text-3xl sm:text-5xl font-semibold leading-tight">
              {t.ctaTitle}
              <span className="block italic font-medium bg-gradient-to-r from-[#f3d9a4] via-[#e9c176] to-[#c89b4f] bg-clip-text text-transparent mt-2">
                {t.ctaAccent}
              </span>
            </h2>
            <p className="text-white/45 mt-6 mb-10 text-sm sm:text-base">{t.ctaSubtitle}</p>
            <Link
              href="/auth/signup"
              className="lux-cta-pulse inline-block px-10 py-4 text-sm font-semibold bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] rounded-full hover:opacity-90 transition-opacity"
            >
              {t.ctaButton}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-10">
            <div className="col-span-2 sm:col-span-1 pr-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] flex items-center justify-center shrink-0">
                  <span className="text-[#141313] font-playfair font-bold text-xs leading-none">{brand.name.charAt(0)}</span>
                </div>
                <span className="font-playfair text-base font-semibold">{brand.name}</span>
              </div>
              <p className="mt-3 text-xs text-white/40 leading-relaxed max-w-[220px]">{t.footerTagline}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">
                {t.footerProductHeading}
              </p>
              <ul className="space-y-2.5">
                <li>
                  <a href="#features" className="text-[13px] text-white/60 hover:text-[#e9c176] transition-colors">
                    {t.nav.platform}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-[13px] text-white/60 hover:text-[#e9c176] transition-colors">
                    {t.nav.pricing}
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-[13px] text-white/60 hover:text-[#e9c176] transition-colors">
                    {t.nav.faq}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">
                {t.footerLegalHeading}
              </p>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/privacy" className="text-[13px] text-white/60 hover:text-[#e9c176] transition-colors">
                    {t.footerPrivacy}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-[13px] text-white/60 hover:text-[#e9c176] transition-colors">
                    {t.footerTerms}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">
                {t.footerCompanyHeading}
              </p>
              <a
                href="https://digitalconnectdr.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-[#e9c176] transition-colors"
              >
                <Image
                  src="/logo-jprs.png"
                  alt={brand.poweredBy}
                  width={20}
                  height={20}
                  className="rounded-md shrink-0"
                />
                {brand.poweredBy}
              </a>
            </div>
          </div>

          <div className="mt-14 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-white/30 order-2 sm:order-1">
              © {new Date().getFullYear()} {brand.name}. {t.footerRights}
            </p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#e9c176]/60 order-1 sm:order-2">
              {dict.common.poweredBy}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
