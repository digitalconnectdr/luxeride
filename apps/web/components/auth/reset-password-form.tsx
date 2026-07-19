'use client'

import { useFormState } from 'react-dom'
import Link from 'next/link'
import { resetPasswordAction } from '@/app/actions/auth'

export interface ResetPasswordLabels {
  title: string
  subtitle: string
  emailLabel: string
  emailPlaceholder: string
  submit: string
  submitting: string
  backToSignIn: string
  successTitle: string
  successMessage: string
}

export function ResetPasswordForm({ labels }: { labels: ResetPasswordLabels }) {
  const [state, action, isPending] = useFormState(resetPasswordAction, null)

  if (state?.success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-gold/10 border border-bronze/30 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-playfair text-2xl font-semibold text-sl-on-surface">
          {labels.successTitle}
        </h2>
        <p className="text-sm text-sl-on-surface-muted max-w-xs mx-auto">
          {labels.successMessage}
        </p>
        <Link
          href="/auth/login"
          className="inline-block mt-4 text-sm text-bronze hover:text-bronze/80 transition-colors"
        >
          {labels.backToSignIn}
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mb-2">
          {labels.title}
        </h1>
        <p className="text-sl-on-surface-muted text-sm">
          {labels.subtitle}
        </p>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 shadow-luxury">
        <form action={action} className="space-y-5">
          {state && !state.success && (
            <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
              <p className="text-sm text-error">{state.error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-sl-on-surface">
              {labels.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
              placeholder={labels.emailPlaceholder}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? labels.submitting : labels.submit}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-sl-outline-variant text-center">
          <Link href="/auth/login" className="text-sm text-sl-on-surface-muted hover:text-bronze transition-colors">
            {labels.backToSignIn}
          </Link>
        </div>
      </div>
    </>
  )
}
