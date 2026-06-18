import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { logoutAction } from '@/app/actions/auth'
import { brandLegal } from '@/lib/brand'

export default async function DispatcherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('dispatcher', 'company_owner', 'company_admin', 'super_admin')

  return (
    <div className="min-h-screen bg-sl-bg flex flex-col">
      <header className="bg-sl-surface-high border-b border-sl-outline-variant shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center">
                <span className="text-gray-900 font-bold text-[10px] leading-none">L</span>
              </div>
              <span className="font-playfair text-sm font-semibold text-sl-on-surface">
                Dispatch
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>
            <nav className="flex items-center gap-4">
              <Link href="/dispatcher/dashboard" className="text-sm text-sl-on-surface-muted hover:text-bronze transition-colors">
                Board
              </Link>
              <Link href="/admin/bookings" className="text-sm text-sl-on-surface-muted hover:text-bronze transition-colors">
                Reservaciones
              </Link>
              <Link href="/admin/bookings/new" className="text-sm text-sl-on-surface-muted hover:text-bronze transition-colors">
                + Nueva
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
      <main className="flex-1 overflow-auto">{children}</main>
      <footer className="px-6 py-2 border-t border-sl-outline-variant text-center shrink-0">
        <p className="text-[9px] uppercase tracking-[0.25em] text-sl-on-surface-muted/60">
          {brandLegal}
        </p>
      </footer>
    </div>
  )
}
