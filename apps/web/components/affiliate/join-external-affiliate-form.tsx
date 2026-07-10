'use client'
// ── Sección G, Fase 2 — Formulario de alta del afiliado externo ───────────────

import { useFormState } from 'react-dom'
import { joinAsExternalAffiliateAction } from '@/app/actions/affiliates'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['affiliates']['join']

export function JoinExternalAffiliateForm({ token, t }: { token: string; t: T }) {
  const boundAction = joinAsExternalAffiliateAction.bind(null, token)
  const [state, action, isPending] = useFormState(boundAction, null)

  const inputClass =
    'w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors'
  const labelClass = 'block text-sm font-medium text-sl-on-surface'

  return (
    <form action={action} className="space-y-6">
      {state && !state.success && (
        <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
          <p className="text-sm text-error">{state.error}</p>
        </div>
      )}

      {/* Dos columnas desde md: hasta ahí el formulario era una sola columna
          angosta (pensada para mobile) que en desktop quedaba absurdamente
          larga — ahora Empresa y Cuenta se ven lado a lado en pantallas
          anchas, una sola columna en mobile. */}
      <div className="grid gap-6 md:grid-cols-2 md:gap-x-8">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.companySection}</p>
          <div className="space-y-1.5">
            <label htmlFor="company_name" className={labelClass}>{t.companyNameLabel}</label>
            <input id="company_name" name="company_name" type="text" required className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="city" className={labelClass}>{t.cityLabel}</label>
            <input id="city" name="city" type="text" className={inputClass} />
          </div>
        </div>

        <div className="space-y-4 md:border-l md:border-sl-outline-variant md:pl-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.ownerSection}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="first_name" className={labelClass}>{t.firstNameLabel}</label>
              <input id="first_name" name="first_name" type="text" autoComplete="given-name" required className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="last_name" className={labelClass}>{t.lastNameLabel}</label>
              <input id="last_name" name="last_name" type="text" autoComplete="family-name" required className={inputClass} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className={labelClass}>{t.emailLabel}</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="phone" className={labelClass}>{t.phoneLabel}</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className={labelClass}>{t.passwordLabel}</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
          </div>
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
