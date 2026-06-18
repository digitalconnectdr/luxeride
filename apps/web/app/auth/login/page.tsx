'use client'

import { Suspense } from 'react'
import { useFormState } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'
import { brand } from '@/lib/brand'

function BlockedBanner() {
  const params = useSearchParams()
  if (params.get('blocked') !== '1') return null
  return (
    <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
      <p className="text-sm text-error">
        Tu cuenta ha sido desactivada. Contacta al administrador de tu empresa.
      </p>
    </div>
  )
}

export default function LoginPage() {
  const [state, action, isPending] = useFormState(loginAction, null)

  return (
    <div>
      {/* Title */}
      <div className="mb-8 text-center">
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mb-2">
          Welcome back
        </h1>
        <p className="text-sl-on-surface-muted text-sm">
          Sign in to your {brand.name} dashboard
        </p>
      </div>

      {/* Card */}
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 shadow-luxury">
        <form action={action} className="space-y-5">
          <Suspense fallback={null}>
            <BlockedBanner />
          </Suspense>

          {/* Error message */}
          {state && !state.success && (
            <div className="rounded-lg bg-error/10 border border-error/30 px-4 py-3">
              <p className="text-sm text-error">{state.error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-sl-on-surface">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
              placeholder="you@company.com"
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-error">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-sl-on-surface">
                Password
              </label>
              <Link
                href="/auth/reset-password"
                className="text-xs text-bronze hover:text-bronze/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors"
              placeholder="••••••••"
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-error">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-bronze focus:ring-offset-2 focus:ring-offset-sl-surface-high disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 pt-6 border-t border-sl-outline-variant text-center">
          <p className="text-sm text-sl-on-surface-muted">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-bronze hover:text-bronze/80 font-medium transition-colors">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
