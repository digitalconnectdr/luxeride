'use client'
// ── Onboarding por link — formulario de alta del miembro corporativo ──────────

import { useFormState } from 'react-dom'
import { acceptCorporateInviteAction } from '@/app/actions/corporate'
import type { Dictionary } from '@/lib/i18n/server'
import type { CorporateInvitePreview } from '@/app/actions/corporate'

type T = Dictionary['corporate']['join']

const inputCls =
  'w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-2.5 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors'
const labelCls = 'block text-sm font-medium text-sl-on-surface'

export function JoinCorporateMemberForm({
  token, preview, t,
}: {
  token: string
  preview: CorporateInvitePreview
  t: T
}) {
  const boundAction = acceptCorporateInviteAction.bind(null, token)
  const [state, action, isPending] = useFormState(boundAction, null)

  if (preview.accountExists) {
    return (
      <form action={action} className="space-y-5 text-center">
        {state && !state.success && (
          <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3 text-left">
            <p className="text-sm text-error">{state.error}</p>
          </div>
        )}
        <p className="text-sm text-sl-on-surface-muted">{t.existingAccountNotice}</p>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-bronze focus:ring-offset-2 focus:ring-offset-sl-surface-high disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? '…' : t.goToLogin}
        </button>
      </form>
    )
  }

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
          <p className="text-sm text-error">{state.error}</p>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-bronze">
        {t.accountSection}
      </p>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="first_name" className={labelCls}>{t.firstNameLabel}</label>
          <input id="first_name" name="first_name" type="text" autoComplete="given-name" required className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="last_name" className={labelCls}>{t.lastNameLabel}</label>
          <input id="last_name" name="last_name" type="text" autoComplete="family-name" required className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className={labelCls}>{t.phoneLabel}</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className={labelCls}>{t.passwordLabel}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-bronze focus:ring-offset-2 focus:ring-offset-sl-surface-high disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? '…' : t.submit}
      </button>
    </form>
  )
}
