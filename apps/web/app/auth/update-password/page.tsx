import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { UpdatePasswordForm } from '@/components/auth/update-password-form'

// Ver nota en app/auth/signup/page.tsx — mismo gap G7, mismo fix.
export function generateMetadata(): Metadata {
  const t = getDict(getLocale()).auth.updatePassword
  return { title: `${t.title} | ${brand.name}`, robots: { index: false, follow: true } }
}

export default function UpdatePasswordPage() {
  const t = getDict(getLocale()).auth.updatePassword

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mb-2">
          {t.title}
        </h1>
        <p className="text-sl-on-surface-muted text-sm">
          {t.subtitle}
        </p>
      </div>

      <UpdatePasswordForm labels={t} />
    </div>
  )
}
