import { getLocale, getDict } from '@/lib/i18n/server'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default function ResetPasswordPage() {
  const t = getDict(getLocale()).auth.resetPassword

  return <ResetPasswordForm labels={t} />
}
