'use client'

import { useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import Link from 'next/link'
import { signupAction } from '@/app/actions/auth'

export interface SignupLabels {
  companySectionLabel: string
  companyNameLabel: string
  companyNamePlaceholder: string
  companyUrlLabel: string
  companySlugPlaceholder: string
  companyCityLabel: string
  companyCityPlaceholder: string
  accountSectionLabel: string
  firstNameLabel: string
  firstNamePlaceholder: string
  lastNameLabel: string
  lastNamePlaceholder: string
  workEmailLabel: string
  workEmailPlaceholder: string
  passwordLabel: string
  passwordPlaceholder: string
  submit: string
  submitting: string
  termsPrefix: string
  termsLink: string
  termsAnd: string
  privacyLink: string
  alreadyHaveAccount: string
  signInLink: string
  nextStep: string
  backStep: string
}

const inputCls =
  'w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors'

// Mismo lenguaje visual del stepper del booking wizard público
// (app/(booking)/book/[slug]/booking-wizard.tsx), adaptado a los tokens
// sl-*/gold/bronze del panel de auth en vez de var(--brand) (que es el
// color del operador, no aplica aquí).
function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-start mb-6">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex-1 flex flex-col items-center relative min-w-0">
            {i < steps.length - 1 && (
              <div className="absolute top-[17px] left-1/2 w-full h-[3px] rounded-full bg-sl-outline-variant overflow-hidden">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-500 ease-out"
                  style={{ width: done ? '100%' : '0%' }}
                />
              </div>
            )}
            <div
              className={`relative z-10 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                done || active
                  ? 'bg-gold text-gray-900'
                  : 'text-sl-on-surface-muted bg-sl-bg border border-sl-outline-variant'
              }`}
            >
              {done ? '✓' : i + 1}
            </div>
            <p className={`mt-2.5 text-xs font-medium text-center px-1 leading-tight ${active ? 'text-sl-on-surface' : done ? 'text-sl-on-surface-muted' : 'text-sl-on-surface-muted/60'}`}>
              {label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function SignupForm({ labels }: { labels: SignupLabels }) {
  const [state, action, isPending] = useFormState(signupAction, null)
  const [step, setStep] = useState<0 | 1>(0)

  // Controlados (no solo uncontrolled + FormData) para no perder lo ya
  // escrito si el usuario va de vuelta al paso 1 y adelante otra vez.
  const [companyName, setCompanyName] = useState('')
  const [companySlug, setCompanySlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const companyNameRef = useRef<HTMLInputElement>(null)
  const companySlugRef = useRef<HTMLInputElement>(null)

  function handleCompanyNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCompanyName(e.target.value)
    if (slugTouched) return
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50)
    setCompanySlug(slug)
  }

  function goNext() {
    const nameOk = companyNameRef.current?.reportValidity() ?? true
    const slugOk = companySlugRef.current?.reportValidity() ?? true
    if (!nameOk || !slugOk) return
    setStep(1)
  }

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 shadow-luxury">
      <StepIndicator current={step} steps={[labels.companySectionLabel, labels.accountSectionLabel]} />

      <form action={action} className="space-y-5">
        {state && !state.success && (
          <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
            <p className="text-sm text-error">{state.error}</p>
          </div>
        )}

        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="company_name" className="block text-sm font-medium text-sl-on-surface">
                {labels.companyNameLabel}
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                ref={companyNameRef}
                value={companyName}
                onChange={handleCompanyNameChange}
                className={inputCls}
                placeholder={labels.companyNamePlaceholder}
              />
              {state?.fieldErrors?.company_name && (
                <p className="text-xs text-error">{state.fieldErrors.company_name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="company_slug" className="block text-sm font-medium text-sl-on-surface">
                {labels.companyUrlLabel}
              </label>
              <div className="flex items-center rounded-lg border border-sl-outline-variant bg-sl-bg overflow-hidden focus-within:border-bronze focus-within:ring-1 focus-within:ring-gold transition-colors">
                <span className="px-3 py-3 text-sm text-sl-on-surface-muted border-r border-sl-outline-variant bg-sl-surface-high whitespace-nowrap">
                  luxeride.app/
                </span>
                <input
                  id="company_slug"
                  name="company_slug"
                  type="text"
                  required
                  ref={companySlugRef}
                  value={companySlug}
                  onChange={(e) => { setSlugTouched(true); setCompanySlug(e.target.value) }}
                  pattern="[a-z0-9-]+"
                  className="flex-1 px-3 py-3 text-sm text-sl-on-surface bg-transparent focus:outline-none"
                  placeholder={labels.companySlugPlaceholder}
                />
              </div>
              {state?.fieldErrors?.company_slug && (
                <p className="text-xs text-error">{state.fieldErrors.company_slug[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="company_city" className="block text-sm font-medium text-sl-on-surface">
                {labels.companyCityLabel}
              </label>
              <input
                id="company_city"
                name="company_city"
                type="text"
                className={inputCls}
                placeholder={labels.companyCityPlaceholder}
              />
            </div>

            {/* Campos del paso 2, ocultos como hidden (no display:none) para
            que sigan viajando en el submit final sin bloquear la validación
            nativa del paso 1. */}
            <input type="hidden" name="first_name" value={firstName} />
            <input type="hidden" name="last_name" value={lastName} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="password" value={password} />

            <button
              type="button"
              onClick={goNext}
              className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-bronze focus:ring-offset-2 focus:ring-offset-sl-surface-high transition-all"
            >
              {labels.nextStep}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Campos del paso 1, viajan como hidden mientras se ve el paso 2. */}
            <input type="hidden" name="company_name" value={companyName} />
            <input type="hidden" name="company_slug" value={companySlug} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="block text-sm font-medium text-sl-on-surface">
                  {labels.firstNameLabel}
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputCls}
                  placeholder={labels.firstNamePlaceholder}
                />
                {state?.fieldErrors?.first_name && (
                  <p className="text-xs text-error">{state.fieldErrors.first_name[0]}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="last_name" className="block text-sm font-medium text-sl-on-surface">
                  {labels.lastNameLabel}
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputCls}
                  placeholder={labels.lastNamePlaceholder}
                />
                {state?.fieldErrors?.last_name && (
                  <p className="text-xs text-error">{state.fieldErrors.last_name[0]}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-sl-on-surface">
                {labels.workEmailLabel}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder={labels.workEmailPlaceholder}
              />
              {state?.fieldErrors?.email && (
                <p className="text-xs text-error">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-sl-on-surface">
                {labels.passwordLabel}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder={labels.passwordPlaceholder}
              />
              {state?.fieldErrors?.password && (
                <p className="text-xs text-error">{state.fieldErrors.password[0]}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-sm text-sl-on-surface-muted hover:text-bronze transition-colors"
              >
                {labels.backStep}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-bronze focus:ring-offset-2 focus:ring-offset-sl-surface-high disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isPending ? labels.submitting : labels.submit}
              </button>
            </div>

            <p className="text-center text-xs text-sl-on-surface-muted">
              {labels.termsPrefix}{' '}
              <Link href="/terms" className="text-bronze hover:underline">{labels.termsLink}</Link>
              {' '}{labels.termsAnd}{' '}
              <Link href="/privacy" className="text-bronze hover:underline">{labels.privacyLink}</Link>.
            </p>
          </div>
        )}
      </form>

      <div className="mt-6 pt-6 border-t border-sl-outline-variant text-center">
        <p className="text-sm text-sl-on-surface-muted">
          {labels.alreadyHaveAccount}{' '}
          <Link href="/auth/login" className="text-bronze hover:text-bronze/80 font-medium transition-colors">
            {labels.signInLink}
          </Link>
        </p>
      </div>
    </div>
  )
}
