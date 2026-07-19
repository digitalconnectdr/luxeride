'use client'

import { useFormState } from 'react-dom'
import { updatePasswordAction } from '@/app/actions/auth'

export interface UpdatePasswordLabels {
  newPasswordLabel: string
  newPasswordPlaceholder: string
  confirmPasswordLabel: string
  confirmPasswordPlaceholder: string
  submit: string
  submitting: string
}

export function UpdatePasswordForm({ labels }: { labels: UpdatePasswordLabels }) {
  const [state, action, isPending] = useFormState(updatePasswordAction, null)

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 shadow-luxury">
      <form action={action} className="space-y-5">
        {state && !state.success && (
          <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
            <p className="text-sm text-error">{state.error}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-sl-on-surface">
            {labels.newPasswordLabel}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
            placeholder={labels.newPasswordPlaceholder}
          />
          {state?.fieldErrors?.password && (
            <p className="text-xs text-error">{state.fieldErrors.password[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm_password" className="block text-sm font-medium text-sl-on-surface">
            {labels.confirmPasswordLabel}
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
            placeholder={labels.confirmPasswordPlaceholder}
          />
          {state?.fieldErrors?.confirm_password && (
            <p className="text-xs text-error">{state.fieldErrors.confirm_password[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? labels.submitting : labels.submit}
        </button>
      </form>
    </div>
  )
}
