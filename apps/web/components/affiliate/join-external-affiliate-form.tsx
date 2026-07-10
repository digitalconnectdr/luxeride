'use client'
// ── Sección G, Fase 2 — Formulario de alta del afiliado externo ───────────────

import { useFormState } from 'react-dom'
import { joinAsExternalAffiliateAction } from '@/app/actions/affiliates'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']['join']

export function JoinExternalAffiliateForm({ token, t }: { token: string; t: T }) {
  const boundAction = joinAsExternalAffiliateAction.bind(null, token)
  const [state, action, isPending] = useFormState(boundAction, null)

  return (
    <form action={action} className="space-y-5">
      {state && !state.success && (
        <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
          <p className="text-sm text-error">{state.error}</p>
        </div>
      )}

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.companySection}</p>
        <div className="space-y-1.5">
          <label htmlFor="company_name" className="block text-sm font-medium text-sl-on-surface">{t.companyNameLabel}</label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            required
            className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="city" className="block text-sm font-medium text-sl-on-surface">{t.cityLabel}</label>
          <input
            id="city"
            name="city"
            type="text"
            className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
          />
        </div>
      </div>

      <div className="border-t border-sl-outline-variant" />

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.ownerSection}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="first_name" className="block text-sm font-medium text-sl-on-surface">{t.firstNameLabel}</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              required
              className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="last_name" className="block text-sm font-medium text-sl-on-surface">{t.lastNameLabel}</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              required
              className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-sl-on-surface">{t.emailLabel}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="block text-sm font-medium text-sl-on-surface">{t.phoneLabel}</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-sl-on-surface">{t.passwordLabel}</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-bronze focus:ring-offset-2 focus:ring-offset-sl-surface-high disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? '…' : t.submit}
      </button>

      <p className="text-center text-xs text-sl-on-surface-muted">{t.whatHappensNext}</p>
    </form>
  )
}
