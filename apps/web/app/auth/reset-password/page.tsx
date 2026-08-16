import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

// Ver nota en app/auth/signup/page.tsx, mismo gap G7, mismo fix.
export function generateMetadata(): Metadata {
  const t = getDict(getLocale()).auth.resetPassword
  return { title: `${t.title} | ${brand.name}`, robots: { index: false, follow: true } }
}

export default function ResetPasswordPage() {
  const t = getDict(getLocale()).auth.resetPassword

  return <ResetPasswordForm labels={t} />
}
