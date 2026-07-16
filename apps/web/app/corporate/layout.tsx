import { requireRole } from '@/lib/auth/session'
import { logoutAction } from '@/app/actions/auth'
import Link from 'next/link'
import { brandLegal } from '@/lib/brand'

export default async function CorporateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('corporate_manager', 'corporate_user')

  return (
    <div className="min-h-screen bg-sl-bg">
      <header className="bg-sl-surface-high border-b border-sl-outline-variant">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center">
                <span className="text-gray-900 font-bold text-[10px] leading-none">L</span>
              </div>
              <span className="font-playfair text-sm font-semibold text-sl-on-surface">
                Portal Corporativo
              </span>
            </div>
            <nav className="flex items-center gap-4">
              <Link href="/corporate/dashboard" prefetch={false} className="text-sm text-sl-on-surface-muted hover:text-bronze transition-colors">
                Dashboard
              </Link>
              <Link href="/corporate/book" prefetch={false} className="text-sm text-sl-on-surface-muted hover:text-bronze transition-colors">
                Reservar
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-sl-on-surface-muted">
              {user.profile.first_name} {user.profile.last_name}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="text-xs text-sl-on-surface-muted hover:text-red-400 transition-colors">
                Sign out →
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
      <footer className="max-w-4xl mx-auto px-6 pb-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-sl-on-surface-muted/60">
          {brandLegal}
        </p>
      </footer>
    </div>
  )
}
