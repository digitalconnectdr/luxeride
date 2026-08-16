import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand, withBrand } from '@/lib/brand'
import { buildMoneyPageStructuredData } from '@/lib/seo/structured-data'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'
import { REFERRAL_TIERS } from '@/lib/referrals/tiers'

const SLUG = '/referral-program'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).referralProgramPage
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

export default function ReferralProgramPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.referralProgramPage
  const l = dict.landing
  const baseUrl = getAppUrl()

  const structuredData = buildMoneyPageStructuredData({
    baseUrl,
    pagePath: SLUG,
    pageTitle: t.metaTitle,
    pageDescription: t.metaDescription,
    breadcrumbItems: [
      { name: brand.name, path: '/' },
      { name: t.breadcrumbLabel, path: SLUG },
    ],
    faq: t.faq,
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
            <Link href="/pricing" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {l.nav.pricing}
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

      {/* ── Hero ── */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 45% at 50% -5%, rgba(233,193,118,0.14), transparent 70%)',
          }}
        />
        <div className="relative max-w-[900px] mx-auto px-6 pt-10 sm:pt-14 pb-16 text-center">
          <Reveal>
            <h1 className="font-playfair text-4xl sm:text-5xl font-semibold leading-[1.1] text-balance">
              {t.h1}{' '}
              <span className="block italic font-medium bg-gradient-to-r from-[#f3d9a4] via-[#e9c176] to-[#c89b4f] bg-clip-text text-transparent mt-2">
                {t.h1Accent}
              </span>
            </h1>
            <p className="text-white/55 mt-7 text-base leading-relaxed max-w-2xl mx-auto">{withBrand(t.subtitle)}</p>
          </Reveal>
        </div>
      </section>

      {/* ── Niveles de comisión (datos reales de lib/referrals/tiers.ts) ── */}
      <section className="border-t border-white/[0.06] py-20 sm:py-24">
        <div className="max-w-[1100px] mx-auto px-6">
          <Reveal className="text-center mb-14">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.tiersTitle}</h2>
            <p className="text-white/45 mt-4 max-w-xl mx-auto text-sm">{t.tiersSubtitle}</p>
          </Reveal>
          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {REFERRAL_TIERS.map((tier, i) => (
              <RevealItem key={tier.key}>
                <div className="h-full bg-white/[0.025] border border-white/[0.08] rounded-2xl p-7 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40 mb-4">
                    {t.tierNames[i]}
                  </p>
                  <p className="font-playfair text-4xl font-semibold text-[#e9c176]">{tier.pct}%</p>
                  <p className="text-[13px] text-white/50 mt-4">
                    {tier.min}
                    {tier.max === null ? t.tierRangePlus : `–${tier.max}`} {t.tierRangeSuffix}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Beneficios ── */}
      <section className="border-t border-white/[0.06] py-20 sm:py-24 bg-white/[0.015]">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-8 sm:px-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
              {l.referralProgram.points.map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="text-[#e9c176] text-base mt-0.5 shrink-0">✓</span>
                  <span className="text-[15px] text-white/80 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-white/[0.06]">
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
                    <span className="text-[#e9c176] text-lg leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-6 pb-5 text-sm text-white/55 leading-relaxed">{item.a}</p>
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
              href="/auth/login"
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
