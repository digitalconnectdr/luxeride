import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand, withBrand } from '@/lib/brand'
import { buildLandingStructuredData } from '@/lib/seo/structured-data'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'
import { PaymentMethodsMarquee } from '@/components/booking/payment-methods-marquee'

const SLUG = '/pricing'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).pricingPage
  const baseUrl = getAppUrl()
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: { canonical: SLUG },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: `${baseUrl}${SLUG}`,
      type: 'website',
      siteName: brand.name,
    },
    twitter: { card: 'summary_large_image', title: t.metaTitle, description: t.metaDescription },
  }
}

export const dynamic = 'force-dynamic' // locale por cookie, mismo patrón que el home

export default function PricingPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.pricingPage
  const l = dict.landing
  const baseUrl = getAppUrl()

  const structuredData = buildLandingStructuredData({
    baseUrl,
    description: t.metaDescription,
    plans: l.plans,
    faq: l.faq.map((item) => ({ q: item.q, a: withBrand(item.a) })),
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
          <Link href="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] flex items-center justify-center shadow-[0_0_18px_rgba(233,193,118,0.35)]">
              <span className="text-[#141313] font-playfair font-bold text-sm leading-none">{brand.name.charAt(0)}</span>
            </div>
            <div className="leading-tight">
              <span className="font-playfair text-lg font-semibold tracking-wide">{brand.name}</span>
              <p className="text-[8px] uppercase tracking-[0.25em] text-white/35">by {brand.poweredBy}</p>
            </div>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            <Link href="/#features" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {l.nav.platform}
            </Link>
            <Link href="/#faq" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {l.nav.faq}
            </Link>
            <LanguageSwitcher current={locale} variant="dark" />
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

      {/* ── Breadcrumb ── */}
      <div className="max-w-[1400px] mx-auto px-6 pt-6">
        <nav aria-label="Breadcrumb" className="text-[12px] text-white/35">
          <Link href="/" className="hover:text-[#e9c176] transition-colors">
            {brand.name}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white/55">{t.breadcrumbLabel}</span>
        </nav>
      </div>

      {/* ── Pricing ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 50% 50% at 50% 0%, rgba(233,193,118,0.07), transparent 70%)',
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-10 sm:pt-14 pb-24">
          <Reveal className="text-center mb-14">
            <h1 className="font-playfair text-4xl sm:text-5xl font-semibold leading-tight text-balance">{t.h1}</h1>
            <p className="text-white/45 mt-4 text-sm sm:text-base max-w-xl mx-auto">{t.subtitle}</p>
            <p className="inline-flex items-center gap-2 mt-6 px-4 py-1.5 rounded-full bg-[#e9c176]/10 border border-[#e9c176]/30 text-sm font-semibold text-[#e9c176]">
              {l.pricingNoSetupBadge}
            </p>
          </Reveal>

          <Reveal className="max-w-3xl mx-auto mb-10 rounded-2xl border-2 border-[#e9c176]/50 bg-gradient-to-br from-[#1a1712] to-[#12100d] px-6 py-6 sm:px-10 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left shadow-[0_0_50px_rgba(233,193,118,0.10)]">
            <span className="lux-badge-pulse shrink-0 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] rounded-full">
              {l.foundingOffer.badge}
            </span>
            <div>
              <p className="font-playfair text-xl font-semibold text-[#e9c176]">{l.foundingOffer.title}</p>
              <p className="text-sm text-white/60 mt-1">{l.foundingOffer.subtitle}</p>
              <p className="text-xs text-white/40 mt-1.5">{l.foundingOffer.note}</p>
            </div>
          </Reveal>

          <Reveal className="max-w-4xl mx-auto mb-14 rounded-2xl border border-[#e9c176]/20 bg-gradient-to-b from-[#e9c176]/[0.06] to-transparent px-6 py-8 sm:px-10">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#e9c176] mb-6">
              {l.pricingIncludedTitle}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
              {l.pricingIncluded.map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="text-[#e9c176] text-base mt-0.5 shrink-0">✓</span>
                  <span className="text-[15px] text-white/80 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {l.plans.map((plan, i) => {
              const popular = i === 1
              const isLast = i === l.plans.length - 1
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
                      {l.pricingPopular}
                    </span>
                  )}
                  <h3 className="font-playfair text-xl font-semibold">{plan.name}</h3>
                  <p className="text-xs text-white/45 mt-2 leading-relaxed">{plan.desc}</p>
                  <p className="mt-6 mb-7">
                    <span className="font-playfair text-4xl font-semibold text-[#e9c176]">{plan.price}</span>
                    <span className="text-sm text-white/40 ml-1">{plan.period}</span>
                  </p>
                  {/* Cada plan (excepto Starter) arranca su array con "Todo lo
                      de {plan anterior}" (índice 0) - esa línea se saca del
                      checklist y se muestra como etiqueta compacta aparte,
                      para que el checklist visible sea 100% features NUEVAS
                      de ese plan frente al anterior. */}
                  {i > 0 && (
                    <p className="mb-3 inline-flex items-center gap-1.5 self-start text-[11px] font-medium text-white/45 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1">
                      <span className="text-white/30">✓</span>
                      {plan.features[0]}
                    </p>
                  )}
                  <ul className="space-y-3 flex-1">
                    {(i > 0 ? plan.features.slice(1) : plan.features).map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <span className="text-xs mt-0.5 shrink-0 text-[#e9c176]">✓</span>
                        <span className="text-[13px] text-white font-medium leading-snug">{f}</span>
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
                    {isLast ? l.pricingContact : l.pricingCta}
                  </Link>
                </RevealItem>
              )
            })}
          </RevealStagger>
          <p className="text-center text-sm text-white/55 mt-10 max-w-2xl mx-auto">{l.pricingFooterNote}</p>
        </div>
      </section>

      {/* ── Formas de pago ── */}
      <section className="border-t border-white/[0.06] py-20 lg:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <PaymentMethodsMarquee acceptsCardOnline t={l} tone="dark" />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <Reveal className="text-center mb-12">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.faqTitle}</h2>
          </Reveal>
          <RevealStagger className="space-y-3">
            {l.faq.map((item) => (
              <RevealItem key={item.q}>
                <details className="group bg-white/[0.025] border border-white/[0.08] rounded-2xl open:border-[#e9c176]/40 transition-colors">
                  <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none">
                    <span className="text-sm font-semibold">{item.q}</span>
                    <span className="text-[#e9c176] text-lg leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-6 pb-5 text-sm text-white/55 leading-relaxed">{withBrand(item.a)}</p>
                </details>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="border-t border-white/[0.06] relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 55% 70% at 50% 110%, rgba(233,193,118,0.12), transparent 70%)',
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
        <div className="max-w-[1400px] mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-white/30">
            © {new Date().getFullYear()} {brand.name}. {l.footerRights}
          </p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#e9c176]/60">{dict.common.poweredBy}</p>
        </div>
      </footer>
    </div>
  )
}
