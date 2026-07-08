// ── Layout compartido para páginas legales (Privacy Policy, Terms of Service) ─
// Mismo tema oscuro + dorado del landing, pero tipografía de prosa (no venta).

import Link from 'next/link'
import { brand } from '@/lib/brand'
import type { Locale } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

export interface LegalSection {
  heading: string
  body: string[]
}

interface Props {
  title: string
  lastUpdated: string
  intro: string
  sections: LegalSection[]
  backLabel: string
  locale: Locale
}

export function LegalPageLayout({ title, lastUpdated, intro, sections, backLabel, locale }: Props) {
  return (
    <div className="min-h-screen bg-[#0c0b0a] text-white">
      <header className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] flex items-center justify-center shrink-0">
              <span className="text-[#141313] font-playfair font-bold text-[10px] leading-none">{brand.name.charAt(0)}</span>
            </div>
            <span className="font-playfair text-sm font-semibold">{brand.name}</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher current={locale} variant="dark" />
            <Link href="/" className="text-xs text-white/50 hover:text-[#e9c176] transition-colors whitespace-nowrap">
              {backLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-playfair text-3xl sm:text-4xl font-semibold">{title}</h1>
        <p className="text-xs text-white/40 mt-3">{lastUpdated}</p>
        <p className="text-white/70 text-[15px] leading-relaxed mt-6">{intro}</p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-playfair text-xl font-semibold text-[#e9c176]">{section.heading}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((p, i) => (
                  <p key={i} className="text-white/70 text-[15px] leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <p className="text-[11px] text-white/30">
            © {new Date().getFullYear()} {brand.name} · {brand.poweredBy}
          </p>
        </div>
      </footer>
    </div>
  )
}
