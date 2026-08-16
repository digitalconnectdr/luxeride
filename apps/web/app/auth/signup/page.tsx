import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { SignupForm } from '@/components/auth/signup-form'

// Antes heredaba el título/robots genéricos del layout raíz (index:true por
// default) — con eso, /auth/signup era indexable pese al disallow en
// robots.txt (que por sí solo no evita que Google indexe la URL desnuda si
// la encuentra enlazada). Ver LUXERIDE_OPTIMIZATION/00_BASELINE_AUDIT.md gap G7.
export function generateMetadata(): Metadata {
  const t = getDict(getLocale()).auth.signup
  return { title: `${t.title} | ${brand.name}`, robots: { index: false, follow: true } }
}

export default function SignupPage() {
  const t = getDict(getLocale()).auth.signup

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

      <SignupForm labels={t} />
    </div>
  )
}
