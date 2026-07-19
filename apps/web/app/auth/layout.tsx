import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { brand, brandLegal } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.auth

  return (
    <div className="min-h-screen flex bg-sl-bg">
      {/* ── Panel de marca (solo desktop) ── */}
      <aside className="hidden lg:flex lg:w-[42%] xl:w-[38%] relative flex-col justify-between bg-[#1d1b18] text-white px-12 py-10 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 30% 20%, rgba(233,193,118,0.16), transparent 65%)',
          }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] flex items-center justify-center shrink-0">
            <span className="text-[#141313] font-playfair font-bold text-sm leading-none">
              {brand.name.charAt(0)}
            </span>
          </div>
          <span className="font-playfair text-xl font-semibold tracking-wide">{brand.name}</span>
        </Link>

        <div className="relative">
          <p className="font-playfair text-3xl xl:text-[2.15rem] font-semibold leading-tight text-balance">
            {t.panelHeadline}
          </p>
          <ul className="mt-8 space-y-4">
            {t.panelPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#e9c176]/15 text-[#e9c176] text-xs font-bold flex items-center justify-center shrink-0">
                  ✓
                </span>
                <span className="text-sm text-white/70 leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[10px] uppercase tracking-[0.25em] text-white/35">{brandLegal}</p>
      </aside>

      {/* ── Contenido ── */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 sm:px-8 py-6">
          <Link href="/" className="flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center">
              <span className="text-gray-900 font-bold text-sm">{brand.name.charAt(0)}</span>
            </div>
            <span className="font-playfair text-xl font-semibold text-sl-on-surface tracking-wide">
              {brand.name}
            </span>
          </Link>
          <LanguageSwitcher current={locale} variant="light" />
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="px-8 py-6 text-center text-xs text-sl-on-surface-muted border-t border-sl-outline-variant space-y-1.5">
          <p className="lg:hidden text-[10px] uppercase tracking-[0.25em] text-bronze/80">{brandLegal}</p>
          <p>
            © {new Date().getFullYear()} {brand.name}. All rights reserved. &nbsp;·&nbsp;
            <Link href="/privacy" className="hover:text-bronze transition-colors">
              Privacy
            </Link>
            &nbsp;·&nbsp;
            <Link href="/terms" className="hover:text-bronze transition-colors">
              Terms
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
