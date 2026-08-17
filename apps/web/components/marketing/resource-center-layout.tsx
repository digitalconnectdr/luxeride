// ── Layout compartido para el Resource Center (Fase 11) ────────────────────
// Mismo tema oscuro + dorado que MoneyPageLayout (header/footer idénticos),
// pero sin las secciones fijas de problema/solución/features/workflow: cada
// página de recurso (calculadora) controla su propio contenido vía children,
// porque una herramienta interactiva no encaja en el molde de pitch comercial.

import Link from 'next/link'
import { getDict } from '@/lib/i18n/server'
import type { Locale } from '@/lib/i18n/config'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { brand } from '@/lib/brand'

export function ResourceCenterLayout({
  locale,
  breadcrumbLabel,
  structuredData,
  children,
}: {
  locale: Locale
  breadcrumbLabel: string
  structuredData: unknown
  children: React.ReactNode
}) {
  const dict = getDict(locale)

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
            <Link href="/resources" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {dict.resourceCenter.index.breadcrumbLabel}
            </Link>
            <Link href="/#pricing" className="hidden md:block text-[13px] text-white/55 hover:text-[#e9c176] transition-colors">
              {dict.landing.nav.pricing}
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
          <Link href="/resources" className="hover:text-[#e9c176] transition-colors">
            {dict.resourceCenter.index.breadcrumbLabel}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white/55">{breadcrumbLabel}</span>
        </nav>
      </div>

      {children}

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
