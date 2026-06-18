import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { brand, brandLegal } from '@/lib/brand'

export const metadata: Metadata = {
  title: {
    template: `%s | ${brand.name}`,
    default: `Sign In | ${brand.name}`,
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale()
  const dict = getDict(locale)

  return (
    <div className="min-h-screen bg-sl-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center">
            <span className="text-gray-900 font-bold text-sm">{brand.name.charAt(0)}</span>
          </div>
          <span className="font-playfair text-xl font-semibold text-sl-on-surface tracking-wide">
            {brand.name}
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <p className="hidden sm:block text-sm text-sl-on-surface-muted">
            {dict.auth.tagline}
          </p>
          <LanguageSwitcher current={locale} variant="light" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 text-center text-xs text-sl-on-surface-muted border-t border-sl-outline-variant space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-bronze/80">
          {brandLegal}
        </p>
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
  )
}
