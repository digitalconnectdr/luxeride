import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { LoginForm } from '@/components/auth/login-form'

// Ver nota en app/auth/signup/page.tsx — mismo gap G7, mismo fix.
export function generateMetadata(): Metadata {
  const t = getDict(getLocale()).auth.login
  return { title: `${t.welcomeBack} | ${brand.name}`, robots: { index: false, follow: true } }
}

export default function LoginPage() {
  const locale = getLocale()
  const t = getDict(locale).auth.login

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mb-2">
          {t.welcomeBack}
        </h1>
        <p className="text-sl-on-surface-muted text-sm">
          {t.subtitle.replace('{brand}', brand.name)}
        </p>
      </div>

      <LoginForm labels={t} />
    </div>
  )
}
