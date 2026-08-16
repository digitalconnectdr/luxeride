// ── Layout compartido para las money pages de SEO (Fase 3) ─────────────────
// Mismo tema oscuro + dorado del landing (header/footer idénticos). El
// contenido de cada sección viene 100% del diccionario de la página que lo
// usa — este componente solo arma el layout, nunca inventa texto.

import Link from 'next/link'
import { getDict } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'
import { brand } from '@/lib/brand'

export interface MoneyPageFeature {
  title: string
  desc: string
}

export interface MoneyPageStep {
  title: string
  desc: string
}

export interface MoneyPageFaqItem {
  q: string
  a: string
}

export interface MoneyPageRelatedLink {
  label: string
  href: string
}

export interface MoneyPageContent {
  breadcrumbLabel: string
  eyebrow: string
  h1: string
  h1Accent: string
  subheadline: string
  heroCtaPrimary: string
  heroCtaSecondary: string
  problemTitle: string
  problemBody: string[]
  solutionTitle: string
  solutionBody: string[]
  featuresTitle: string
  featuresSubtitle: string
  features: MoneyPageFeature[]
  workflowTitle: string
  workflowSubtitle: string
  workflowSteps: MoneyPageStep[]
  useCasesTitle: string
  useCases: MoneyPageFeature[]
  benefitsTitle: string
  benefits: MoneyPageFeature[]
  faqTitle: string
  faq: MoneyPageFaqItem[]
  relatedTitle: string
  ctaTitle: string
  ctaAccent: string
  ctaSubtitle: string
  ctaButton: string
}

export function MoneyPageLayout({
  locale,
  content,
  relatedLinks,
  structuredData,
}: {
  locale: Locale
  content: MoneyPageContent
  relatedLinks: MoneyPageRelatedLink[]
  structuredData: unknown
}) {
  const dict = getDict(locale)
  const t = content

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
            <Link href="/#pricing" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {dict.landing.nav.pricing}
            </Link>
            <Link href="/#faq" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {dict.landing.nav.faq}
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
        <div className="relative max-w-[1000px] mx-auto px-6 pt-10 sm:pt-14 pb-16 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-3 mb-7 justify-center">
              <span className="h-px w-10 bg-[#e9c176]/60" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176]">{t.eyebrow}</p>
              <span className="h-px w-10 bg-[#e9c176]/60" />
            </div>
            <h1 className="font-playfair text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] text-balance">
              {t.h1}{' '}
              <span className="block italic font-medium bg-gradient-to-r from-[#f3d9a4] via-[#e9c176] to-[#c89b4f] bg-clip-text text-transparent mt-2">
                {t.h1Accent}
              </span>
            </h1>
            <p className="text-white/55 mt-7 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">{t.subheadline}</p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                className="lux-cta-pulse w-full sm:w-auto px-8 py-3.5 text-sm font-semibold bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] rounded-full hover:opacity-90 transition-opacity"
              >
                {t.heroCtaPrimary}
              </Link>
              <Link
                href="/#pricing"
                className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold border border-white/20 rounded-full hover:border-[#e9c176]/60 hover:text-[#e9c176] transition-colors"
              >
                {t.heroCtaSecondary}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Problema ── */}
      <section className="border-t border-white/[0.06] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal>
            <h2 className="font-playfair text-2xl sm:text-3xl font-semibold text-center">{t.problemTitle}</h2>
            <div className="mt-6 space-y-4">
              {t.problemBody.map((p, i) => (
                <p key={i} className="text-white/60 text-[15px] leading-relaxed text-center">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Solución ── */}
      <section className="border-t border-white/[0.06] py-20 bg-white/[0.015]">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal>
            <h2 className="font-playfair text-2xl sm:text-3xl font-semibold text-center">{t.solutionTitle}</h2>
            <div className="mt-6 space-y-4">
              {t.solutionBody.map((p, i) => (
                <p key={i} className="text-white/60 text-[15px] leading-relaxed text-center">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="border-t border-white/[0.06] py-20 sm:py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal className="text-center mb-14">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.featuresTitle}</h2>
            <p className="text-white/45 mt-4 max-w-xl mx-auto text-sm">{t.featuresSubtitle}</p>
          </Reveal>
          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.features.map((f) => (
              <RevealItem key={f.title}>
                <div className="h-full bg-white/[0.025] border border-white/[0.08] rounded-2xl p-7 hover:border-[#e9c176]/30 transition-colors">
                  <h3 className="font-semibold text-[15px]">{f.title}</h3>
                  <p className="text-white/50 text-[13px] leading-relaxed mt-2.5">{f.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="border-t border-white/[0.06] py-20 sm:py-24 bg-white/[0.015]">
        <div className="max-w-4xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.workflowTitle}</h2>
            <p className="text-white/45 mt-4 max-w-xl mx-auto text-sm">{t.workflowSubtitle}</p>
          </Reveal>
          <RevealStagger className="space-y-5">
            {t.workflowSteps.map((step, i) => (
              <RevealItem key={step.title}>
                <div className="flex items-start gap-5 bg-white/[0.025] border border-white/[0.08] rounded-2xl p-6">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] flex items-center justify-center">
                    <span className="text-[#141313] font-playfair font-bold text-sm">{i + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[15px]">{step.title}</h3>
                    <p className="text-white/50 text-[13px] leading-relaxed mt-1.5">{step.desc}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Casos de uso ── */}
      <section className="border-t border-white/[0.06] py-20 sm:py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal className="text-center mb-14">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.useCasesTitle}</h2>
          </Reveal>
          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.useCases.map((u) => (
              <RevealItem key={u.title}>
                <div className="h-full bg-white/[0.025] border border-white/[0.08] rounded-2xl p-7">
                  <h3 className="font-semibold text-[15px] text-[#e9c176]">{u.title}</h3>
                  <p className="text-white/50 text-[13px] leading-relaxed mt-2.5">{u.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Beneficios ── */}
      <section className="border-t border-white/[0.06] py-20 sm:py-24 bg-white/[0.015]">
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal className="text-center mb-14">
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold">{t.benefitsTitle}</h2>
          </Reveal>
          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.benefits.map((b) => (
              <RevealItem key={b.title}>
                <div className="h-full p-2">
                  <h3 className="font-semibold text-[15px]">{b.title}</h3>
                  <p className="text-white/50 text-[13px] leading-relaxed mt-2">{b.desc}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
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

      {/* ── Enlaces relacionados ── */}
      <section className="border-t border-white/[0.06] py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/35 text-center mb-6">
            {t.relatedTitle}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-5 py-2.5 text-[13px] text-white/60 border border-white/10 rounded-full hover:border-[#e9c176]/40 hover:text-[#e9c176] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
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
            © {new Date().getFullYear()} {brand.name}. {dict.landing.footerRights}
          </p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#e9c176]/60">{dict.common.poweredBy}</p>
        </div>
      </footer>
    </div>
  )
}
