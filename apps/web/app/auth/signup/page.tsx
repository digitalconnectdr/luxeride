'use client'

import { useRef } from 'react'
import { useFormState } from 'react-dom'
import Link from 'next/link'
import { signupAction } from '@/app/actions/auth'

export default function SignupPage() {
  const [state, action, isPending] = useFormState(signupAction, null)
  const slugRef = useRef<HTMLInputElement>(null)

  // Auto-generate slug from company name
  function handleCompanyNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugRef.current) return
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50)
    slugRef.current.value = slug
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mb-2">
          Start your free trial
        </h1>
        <p className="text-sl-on-surface-muted text-sm">
          14 days free · No credit card required
        </p>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 shadow-luxury">
        <form action={action} className="space-y-5">
          {state && !state.success && (
            <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
              <p className="text-sm text-error">{state.error}</p>
            </div>
          )}

          {/* Company Section */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              Company
            </p>

            <div className="space-y-1.5">
              <label htmlFor="company_name" className="block text-sm font-medium text-sl-on-surface">
                Company name
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                required
                onChange={handleCompanyNameChange}
                className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
                placeholder="Elite Chauffeur Services"
              />
              {state?.fieldErrors?.company_name && (
                <p className="text-xs text-error">{state.fieldErrors.company_name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="company_slug" className="block text-sm font-medium text-sl-on-surface">
                Company URL
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
                  ref={slugRef}
                  pattern="[a-z0-9-]+"
                  className="flex-1 px-3 py-3 text-sm text-sl-on-surface bg-transparent focus:outline-none"
                  placeholder="elite-chauffeur"
                />
              </div>
              {state?.fieldErrors?.company_slug && (
                <p className="text-xs text-error">{state.fieldErrors.company_slug[0]}</p>
              )}
            </div>
          </div>

          <div className="border-t border-sl-outline-variant" />

          {/* Owner Section */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              Your account
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="block text-sm font-medium text-sl-on-surface">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  autoComplete="given-name"
                  required
                  className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
                  placeholder="James"
                />
                {state?.fieldErrors?.first_name && (
                  <p className="text-xs text-error">{state.fieldErrors.first_name[0]}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="last_name" className="block text-sm font-medium text-sl-on-surface">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  autoComplete="family-name"
                  required
                  className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
                  placeholder="Wilson"
                />
                {state?.fieldErrors?.last_name && (
                  <p className="text-xs text-error">{state.fieldErrors.last_name[0]}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-sl-on-surface">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
                placeholder="james@elitechauffeur.com"
              />
              {state?.fieldErrors?.email && (
                <p className="text-xs text-error">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-sl-on-surface">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
                placeholder="Minimum 8 characters"
              />
              {state?.fieldErrors?.password && (
                <p className="text-xs text-error">{state.fieldErrors.password[0]}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-bronze focus:ring-offset-2 focus:ring-offset-sl-surface-high disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? 'Creating account…' : 'Create account | it\'s free'}
          </button>

          <p className="text-center text-xs text-sl-on-surface-muted">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="text-bronze hover:underline">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-bronze hover:underline">Privacy Policy</Link>.
          </p>
        </form>

        <div className="mt-6 pt-6 border-t border-sl-outline-variant text-center">
          <p className="text-sm text-sl-on-surface-muted">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-bronze hover:text-bronze/80 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
