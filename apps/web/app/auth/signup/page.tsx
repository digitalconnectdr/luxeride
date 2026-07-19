import { getLocale, getDict } from '@/lib/i18n/server'
import { SignupForm } from '@/components/auth/signup-form'

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
