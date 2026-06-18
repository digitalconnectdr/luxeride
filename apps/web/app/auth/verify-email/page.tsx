import Link from 'next/link'
import { brand } from '@/lib/brand'

export default function VerifyEmailPage() {
  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-gold/10 border border-bronze/30 flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
          Verify your email
        </h1>
        <p className="text-sl-on-surface-muted text-sm max-w-xs mx-auto">
          We&apos;ve sent a confirmation link to your email address. Click it to activate your {brand.name} account.
        </p>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 text-left space-y-3 shadow-luxury">
        <p className="text-sm font-medium text-sl-on-surface">Next steps:</p>
        <ol className="space-y-2 text-sm text-sl-on-surface-muted list-decimal list-inside">
          <li>Check your inbox (and spam folder)</li>
          <li>Click the confirmation link</li>
          <li>Sign in to your new dashboard</li>
        </ol>
      </div>

      <p className="text-sm text-sl-on-surface-muted">
        Already confirmed?{' '}
        <Link href="/auth/login" className="text-bronze hover:text-bronze/80 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
