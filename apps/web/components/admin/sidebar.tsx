'use client'
// ── Sidebar del admin — colapsable (solo íconos) para ganar espacio ───────────
// El estado se persiste en localStorage. Cada item tiene ícono (lucide) y en
// modo colapsado muestra tooltip nativo con el nombre.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  RadioTower,
  Car,
  Users,
  MapPinned,
  Plane,
  Tags,
  CalendarDays,
  FileText,
  BarChart3,
  ScrollText,
  MessageSquare,
  AlertTriangle,
  Building2,
  UserCog,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { brand } from '@/lib/brand'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

const STORAGE_KEY = 'luxeride_sidebar_collapsed'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface NavSection {
  header: string
  show: boolean
  items: NavItem[]
}

interface Props {
  companyName: string
  logoUrl?: string | null
  roleLabel: string
  userName: string
  userEmail: string
  locale: Locale
  nav: Dictionary['adminNav']
  flags: {
    isOwner: boolean
    isOwnerOrAdmin: boolean
    isDispatcher: boolean
    isAccounting: boolean
  }
}

export function AdminSidebar({
  companyName,
  logoUrl,
  roleLabel,
  userName,
  userEmail,
  locale,
  nav,
  flags,
}: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Restaurar preferencia (después del mount — evita hydration mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1') {
      setCollapsed(true)
    }
  }, [])

  function toggle() {
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // localStorage no disponible — solo estado en memoria
      }
      return next
    })
  }

  const sections: NavSection[] = [
    {
      header: nav.overview,
      show: true,
      items: [{ href: '/admin/dashboard', label: nav.dashboard, icon: LayoutDashboard }],
    },
    {
      header: nav.operations,
      show: flags.isOwnerOrAdmin || flags.isDispatcher,
      items: [
        { href: '/dispatcher/dashboard', label: nav.dispatch, icon: RadioTower },
        { href: '/admin/fleet', label: nav.fleet, icon: Car },
        { href: '/admin/drivers', label: nav.drivers, icon: Users },
      ],
    },
    {
      header: nav.geography,
      show: flags.isOwnerOrAdmin || flags.isDispatcher,
      items: [
        { href: '/admin/zones', label: nav.zones, icon: MapPinned },
        { href: '/admin/airports', label: nav.airports, icon: Plane },
      ],
    },
    {
      header: nav.pricing,
      show: flags.isOwnerOrAdmin,
      items: [{ href: '/admin/pricing', label: nav.pricingRules, icon: Tags }],
    },
    {
      header: nav.bookings,
      show: flags.isOwnerOrAdmin || flags.isDispatcher,
      items: [
        { href: '/admin/bookings', label: nav.reservations, icon: CalendarDays },
        { href: '/admin/quotes', label: nav.quotes, icon: FileText },
        { href: '/admin/messages', label: nav.messages, icon: MessageSquare },
        { href: '/admin/driver-reports', label: nav.driverReports, icon: AlertTriangle },
      ],
    },
    {
      header: nav.finance,
      show: flags.isOwnerOrAdmin || flags.isAccounting,
      items: [
        { href: '/admin/reports', label: nav.reports, icon: BarChart3 },
        { href: '/admin/audit', label: nav.auditLog, icon: ScrollText },
      ],
    },
    {
      header: nav.management,
      show: flags.isOwnerOrAdmin,
      items: [
        { href: '/admin/corporate', label: nav.corporate, icon: Building2 },
        { href: '/admin/team', label: nav.team, icon: UserCog },
        { href: '/admin/compliance', label: nav.compliance, icon: ShieldCheck },
        ...(flags.isOwner
          ? [{ href: '/admin/settings', label: nav.settings, icon: Settings }]
          : []),
      ],
    },
  ]

  const initials = userName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-56'} bg-sl-surface-high border-r border-sl-outline-variant flex flex-col shrink-0 transition-[width] duration-200 ease-out`}
    >
      {/* Wordmark + toggle */}
      <div className={`py-5 border-b border-sl-outline-variant ${collapsed ? 'px-0' : 'px-5'}`}>
        <div className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between gap-2'}`}>
          <Link
            href="/admin/dashboard"
            prefetch={false}
            title={nav.dashboard}
            className={`flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity ${collapsed ? 'justify-center' : ''}`}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center shrink-0">
                <span className="text-gray-900 font-bold text-[10px] leading-none">
                  {companyName.trim().charAt(0).toUpperCase() || 'L'}
                </span>
              </div>
            )}
            {!collapsed && (
              <span className="font-playfair text-sm font-semibold text-sl-on-surface truncate">
                {companyName}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            title={collapsed ? 'Expandir' : 'Minimizar'}
            className="p-1 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors shrink-0"
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
        {!collapsed && (
          <p className="mt-1 text-[10px] text-sl-on-surface-muted capitalize pl-8">{roleLabel}</p>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'}`}>
        {sections.map((section) =>
          !section.show ? null : (
            <div key={section.header}>
              {!collapsed ? (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted first:pt-1">
                  {section.header}
                </p>
              ) : (
                <div className="my-3 mx-2 h-px bg-sl-outline-variant first:hidden" />
              )}
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    title={collapsed ? item.label : undefined}
                    className={[
                      'flex items-center gap-2.5 rounded-lg text-[13px] transition-colors',
                      collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
                      active
                        ? 'bg-sl-bg text-bronze font-medium'
                        : 'text-sl-on-surface-muted hover:text-sl-on-surface hover:bg-sl-bg/60',
                    ].join(' ')}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ),
        )}
      </nav>

      {/* User + logout */}
      <div className={`py-4 border-t border-sl-outline-variant ${collapsed ? 'px-2' : 'px-4'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div
              title={`${userName} · ${userEmail}`}
              className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center"
            >
              <span className="text-[10px] font-semibold text-bronze">{initials || 'U'}</span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-sl-on-surface-muted hover:text-red-400 hover:bg-sl-bg transition-colors"
              >
                <LogOut size={15} />
              </button>
            </form>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-sl-on-surface truncate">{userName}</p>
            <p className="text-[11px] text-sl-on-surface-muted truncate mt-0.5">{userEmail}</p>
            <div className="mt-2">
              <LanguageSwitcher current={locale} variant="light" />
            </div>
            <form action={logoutAction} className="mt-2">
              <button
                type="submit"
                className="flex items-center gap-1.5 text-[11px] text-sl-on-surface-muted hover:text-red-400 transition-colors"
              >
                <LogOut size={12} />
                Sign out
              </button>
            </form>
            <p className="mt-3 pt-3 border-t border-sl-outline-variant text-[9px] uppercase tracking-[0.18em] text-sl-on-surface-muted/70">
              {brand.name} · Powered by
              <span className="block text-bronze/80">{brand.poweredBy}</span>
            </p>
          </>
        )}
      </div>
    </aside>
  )
}
