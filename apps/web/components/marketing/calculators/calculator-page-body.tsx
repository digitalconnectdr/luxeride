import Link from 'next/link'
import { Reveal, RevealStagger, RevealItem } from '@/components/landing/reveal'

interface CalculatorContentShape {
  eyebrow: string
  h1: string
  h1Accent: string
  subheadline: string
  methodologyTitle: string
  methodologyBody: string[]
  faqTitle: string
  faq: { q: string; a: string }[]
  relatedTitle: string
  ctaTitle: string
  ctaAccent: string
  ctaSubtitle: string
  ctaButton: string
}

export function CalculatorPageBody({
  content,
  calculator,
  relatedLinks,
}: {
  content: CalculatorContentShape
  calculator: React.ReactNode
  relatedLinks: { label: string; href: string }[]
}) {
  const t = content
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 45% at 50% -5%, rgba(233,193,118,0.14), transparent 70%)',
          }}
        />
        <div className="relative max-w-[820px] mx-auto px-6 pt-10 sm:pt-14 pb-12 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-3 mb-7 justify-center">
              <span className="h-px w-10 bg-[#e9c176]/60" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#e9c176]">{t.eyebrow}</p>
              <span className="h-px w-10 bg-[#e9c176]/60" />
            </div>
            <h1 className="font-playfair text-4xl sm:text-5xl font-semibold leading-[1.08] text-balance">
              {t.h1}{' '}
              <span className="block italic font-medium bg-gradient-to-r from-[#f3d9a4] via-[#e9c176] to-[#c89b4f] bg-clip-text text-transparent mt-2">
                {t.h1Accent}
              </span>
            </h1>
            <p className="text-white/55 mt-7 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">{t.subheadline}</p>
          </Reveal>
        </div>
      </section>

      {/* ── Calculadora ── */}
      <section className="px-6">
        <div className="max-w-[820px] mx-auto pb-16">
          <Reveal>{calculator}</Reveal>
        </div>
      </section>

      {/* ── Metodología ── */}
      <section className="border-t border-white/[0.06] py-16 sm:py-20 bg-white/[0.015]">
        <div className="max-w-2xl mx-auto px-6">
          <Reveal>
            <h2 className="font-playfair text-2xl sm:text-3xl font-semibold text-center">{t.methodologyTitle}</h2>
            <div className="mt-6 space-y-3">
              {t.methodologyBody.map((p, i) => (
                <p key={i} className="text-white/60 text-[14px] leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <Reveal className="text-center mb-10">
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
    </>
  )
}
