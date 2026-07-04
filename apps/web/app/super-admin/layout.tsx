import { requireRole } from '@/lib/auth/session'
import { logoutAction } from '@/app/actions/auth'
import { NavLink } from '@/components/super-admin/nav-link'
import { brand } from '@/lib/brand'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('super_admin')

  return (
    <div className="min-h-screen bg-sl-bg flex">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-sl-surface-high border-r border-sl-outline-variant flex flex-col shrink-0">
        {/* Wordmark */}
        <div className="px-5 py-5 border-b border-sl-outline-variant">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center shrink-0">
              <span className="text-gray-900 font-bold text-[10px] leading-none">{brand.name.charAt(0)}</span>
            </div>
            <span className="font-playfair text-sm font-semibold text-sl-on-surface">
              {brand.name}
            </span>
            <span className="ml-auto text-[9px] font-bold tracking-wider text-bronze border border-bronze/40 rounded px-1.5 py-0.5">
              SA
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Overview
          </p>
          <NavLink href="/super-admin/dashboard" label="Dashboard" />

          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Management
          </p>
          <NavLink href="/super-admin/companies" label="Companies" />
          <NavLink href="/super-admin/subscriptions" label="Suscripciones" />
          <NavLink href="/super-admin/enterprise-leads" label="Leads Enterprise" />
          <NavLink href="/super-admin/tracking" label="Tracking en vivo" />
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-sl-outline-variant">
          <p className="text-xs font-medium text-sl-on-surface truncate">
            {user.profile.first_name} {user.profile.last_name}
          </p>
          <p className="text-[11px] text-sl-on-surface-muted truncate mt-0.5">{user.email}</p>
          <form action={logoutAction} className="mt-2">
            <button
              type="submit"
              className="text-[11px] text-sl-on-surface-muted hover:text-red-400 transition-colors"
            >
              Sign out →
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
