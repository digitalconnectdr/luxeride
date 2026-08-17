import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { buildMoneyPageStructuredData } from '@/lib/seo/structured-data'
import { ResourceCenterLayout } from '@/components/marketing/resource-center-layout'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'

const SLUG = '/resources'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).resourceCenter.index
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

export const dynamic = 'force-dynamic'

export default function ResourcesIndexPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const content = dict.resourceCenter.index
  const baseUrl = getAppUrl()

  const structuredData = buildMoneyPageStructuredData({
    baseUrl,
    pagePath: SLUG,
    pageTitle: content.metaTitle,
    pageDescription: content.metaDescription,
    breadcrumbItems: [
      { name: brand.name, path: '/' },
      { name: content.breadcrumbLabel, path: SLUG },
    ],
    faq: [],
  })

  const relatedLinks = [
    { label: dict.pricingPage.breadcrumbLabel, href: '/pricing' },
    { label: dict.moneyPages.limoSoftware.breadcrumbLabel, href: '/limo-software' },
    { label: dict.infoPages.about.breadcrumbLabel, href: '/about' },
  ]

  return (
    <ResourceCenterLayout locale={locale} breadcrumbLabel={content.breadcrumbLabel} structuredData={structuredData}>
      {/* ── Hero ── */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 45% at 50% -5%, rgba(233,193,118,0.14), transparent 70%)',
          }}
        />
        <div className="relative max-w-[900px] mx-auto px-6 pt-10 sm:pt-14 pb-8 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-3 mb-7 justify-center">
              <span className="h-px w-10 bg-[#e9c176]/60" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176]">{content.eyebrow}</p>
              <span className="h-px w-10 bg-[#e9c176]/60" />
            </div>
            <h1 className="font-playfair text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] text-balance">
              {content.h1}{' '}
              <span className="block italic font-medium bg-gradient-to-r from-[#f3d9a4] via-[#e9c176] to-[#c89b4f] bg-clip-text text-transparent mt-2">
                {content.h1Accent}
              </span>
            </h1>
            <p className="text-white/55 mt-7 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">{content.subheadline}</p>
            <p className="text-white/35 mt-4 text-[13px] max-w-xl mx-auto">{content.disclaimer}</p>
          </Reveal>
        </div>
      </section>

      {/* ── Grid de herramientas ── */}
      <section className="py-12 sm:py-16">
        <div className="max-w-[1000px] mx-auto px-6">
          <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {content.tools.map((tool) => (
              <RevealItem key={tool.href}>
                <Link
                  href={tool.href}
                  className="group h-full flex flex-col bg-white/[0.025] border border-white/[0.08] rounded-2xl p-7 hover:border-[#e9c176]/40 transition-colors"
                >
                  <h3 className="font-semibold text-[16px] group-hover:text-[#e9c176] transition-colors">{tool.title}</h3>
                  <p className="text-white/50 text-[13px] leading-relaxed mt-2.5 flex-1">{tool.desc}</p>
                  <span className="mt-4 text-[12px] font-semibold text-[#e9c176]">→</span>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ── Enlaces relacionados ── */}
      <section className="border-t border-white/[0.06] py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/35 text-center mb-6">
            {content.relatedTitle}
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
              {content.ctaTitle}
              <span className="block italic font-medium bg-gradient-to-r from-[#f3d9a4] via-[#e9c176] to-[#c89b4f] bg-clip-text text-transparent mt-2">
                {content.ctaAccent}
              </span>
            </h2>
            <p className="text-white/45 mt-6 mb-10 text-sm sm:text-base">{content.ctaSubtitle}</p>
            <Link
              href="/auth/signup"
              className="lux-cta-pulse inline-block px-10 py-4 text-sm font-semibold bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] text-[#141313] rounded-full hover:opacity-90 transition-opacity"
            >
              {content.ctaButton}
            </Link>
          </Reveal>
        </div>
      </section>
    </ResourceCenterLayout>
  )
}
