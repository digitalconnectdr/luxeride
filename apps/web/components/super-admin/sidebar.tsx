'use client'
// ── Sidebar del super-admin — mismo patrón que components/admin/sidebar.tsx:
// colapsable a solo íconos en desktop (persistido en localStorage) y drawer
// completo en móvil (< md) detrás de un botón hamburguesa, para que ambos
// paneles del sistema se vean y se comporten igual.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Star,
  Handshake,
  RadioTower,
  ShieldCheck,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { brand } from '@/lib/brand'

const STORAGE_KEY = 'luxeride_superadmin_sidebar_collapsed'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const OVERVIEW_ITEMS: NavItem[] = [
  { href: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const MANAGEMENT_ITEMS: NavItem[] = [
  { href: '/super-admin/companies', label: 'Companies', icon: Building2 },
  { href: '/super-admin/subscriptions', label: 'Suscripciones', icon: CreditCard },
  { href: '/super-admin/enterprise-leads', label: 'Leads Enterprise', icon: Star },
  { href: '/super-admin/affiliate-leads', label: 'Leads Affiliate Network', icon: Handshake },
  { href: '/super-admin/tracking', label: 'Tracking en vivo', icon: RadioTower },
  { href: '/super-admin/compliance', label: 'Compliance', icon: ShieldCheck },
]

export function SuperAdminSidebar({
  userName,
  userEmail,
}: {
  userName: string
  userEmail: string
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1') {
      setCollapsed(true)
    }
  }, [])

  // El modo "colapsado a íconos" solo aplica en desktop — en móvil el drawer
  // siempre muestra las etiquetas completas.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const effectiveCollapsed = collapsed && isDesktop

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

  const initials = userName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        title={effectiveCollapsed ? item.label : undefined}
        className={[
          'flex items-center gap-2.5 rounded-lg text-[13px] transition-colors',
          effectiveCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
          active
            ? 'bg-sl-bg text-bronze font-medium'
            : 'text-sl-on-surface-muted hover:text-sl-on-surface hover:bg-sl-bg/60',
        ].join(' ')}
      >
        <Icon size={16} className="shrink-0" />
        {!effectiveCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  return (
    <>
      {/* Barra móvil (< md) — el aside completo vive fuera de pantalla */}
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-sl-surface-high border-b border-sl-outline-variant">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1.5 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center shrink-0">
          <span className="text-gray-900 font-bold text-[10px] leading-none">{brand.name.charAt(0)}</span>
        </div>
        <span className="font-playfair text-sm font-semibold text-sl-on-surface truncate">{brand.name}</span>
        <span className="ml-auto text-[9px] font-bold tracking-wider text-bronze border border-bronze/40 rounded px-1.5 py-0.5">
          SA
        </span>
      </div>

      {/* Fondo oscuro del drawer móvil */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 ${effectiveCollapsed ? 'md:w-16' : 'md:w-56'} bg-sl-surface-high border-r border-sl-outline-variant flex flex-col shrink-0 transition-transform md:transition-[width] duration-200 ease-out transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Wordmark + toggle */}
        <div className={`py-5 border-b border-sl-outline-variant ${effectiveCollapsed ? 'px-0' : 'px-5'}`}>
          <div className={`flex items-center ${effectiveCollapsed ? 'flex-col gap-3' : 'gap-2.5'}`}>
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center shrink-0">
              <span className="text-gray-900 font-bold text-[10px] leading-none">{brand.name.charAt(0)}</span>
            </div>
            {!effectiveCollapsed && (
              <>
                <span className="font-playfair text-sm font-semibold text-sl-on-surface truncate">
                  {brand.name}
                </span>
                <span className="ml-auto text-[9px] font-bold tracking-wider text-bronze border border-bronze/40 rounded px-1.5 py-0.5">
                  SA
                </span>
              </>
            )}
            {/* Colapsar a íconos — solo desktop */}
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              title={collapsed ? 'Expandir' : 'Minimizar'}
              className={`hidden md:block p-1 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors shrink-0 ${effectiveCollapsed ? '' : 'ml-auto'}`}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
            {/* Cerrar drawer — solo móvil */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="md:hidden ml-auto p-1 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden ${effectiveCollapsed ? 'px-2' : 'px-3'}`}>
          <div>
            {!effectiveCollapsed ? (
              <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                Overview
              </p>
            ) : (
              <div className="my-3 mx-2 h-px bg-sl-outline-variant first:hidden" />
            )}
            {OVERVIEW_ITEMS.map(renderItem)}
          </div>
          <div>
            {!effectiveCollapsed ? (
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                Management
              </p>
            ) : (
              <div className="my-3 mx-2 h-px bg-sl-outline-variant" />
            )}
            {MANAGEMENT_ITEMS.map(renderItem)}
          </div>
        </nav>

        {/* User + logout */}
        <div className={`py-4 border-t border-sl-outline-variant ${effectiveCollapsed ? 'px-2' : 'px-4'}`}>
          {effectiveCollapsed ? (
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
              <form action={logoutAction} className="mt-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-[11px] text-sl-on-surface-muted hover:text-red-400 transition-colors"
                >
                  <LogOut size={12} />
                  Sign out
                </button>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
