'use client'
// ── Sidebar del super-admin — mismo diseño que components/admin/sidebar.tsx:
// fondo negro carbón premium, nav con item activo dorado, scroll propio del
// nav (sticky h-screen), footer con idioma + salir en una línea y atribución
// centrada al pie. Colapsable a solo íconos en desktop (localStorage) y drawer
// completo en móvil (< md), para que ambos paneles se vean y comporten igual.

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
  Lightbulb,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { brand } from '@/lib/brand'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import type { Locale } from '@/lib/i18n/config'

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
  { href: '/super-admin/feature-requests', label: 'Solicitudes', icon: Lightbulb },
]

export function SuperAdminSidebar({
  userName,
  userEmail,
  locale,
}: {
  userName: string
  userEmail: string
  locale: Locale
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
            ? 'bg-gold/15 text-gold font-medium border border-gold/30'
            : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent',
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
      <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#1a1613]">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-3 -ml-3 rounded-lg text-white/50 hover:text-gold hover:bg-white/5 transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center shrink-0">
          <span className="text-gray-900 font-bold text-[10px] leading-none">{brand.name.charAt(0)}</span>
        </div>
        <span className="font-playfair text-sm font-semibold text-white truncate">{brand.name}</span>
        <span className="ml-auto text-[9px] font-bold tracking-wider text-gold border border-gold/40 rounded px-1.5 py-0.5">
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
        className={`fixed md:sticky md:top-0 inset-y-0 md:inset-y-auto left-0 z-50 md:z-auto w-72 md:h-screen ${effectiveCollapsed ? 'md:w-16' : 'md:w-72'} bg-[#1a1613] flex flex-col shrink-0 transition-transform md:transition-[width] duration-200 ease-out transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Wordmark + toggle — el nombre nunca se trunca con "…", envuelve en su lugar. */}
        <div className={`py-6 border-b border-white/10 ${effectiveCollapsed ? 'px-0' : 'px-5'}`}>
          <div className={`flex ${effectiveCollapsed ? 'flex-col items-center gap-3' : 'items-start gap-2.5'}`}>
            <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center shrink-0">
              <span className="text-gray-900 font-bold text-sm leading-none">{brand.name.charAt(0)}</span>
            </div>
            {!effectiveCollapsed && (
              <>
                <span className="font-playfair text-base font-semibold text-white leading-snug line-clamp-2 break-words min-w-0">
                  {brand.name}
                </span>
                <span className="ml-auto shrink-0 text-[9px] font-bold tracking-wider text-gold border border-gold/40 rounded px-1.5 py-0.5">
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
              className={`hidden md:block p-1 rounded-lg text-white/40 hover:text-gold hover:bg-white/5 transition-colors shrink-0 ${effectiveCollapsed ? '' : 'ml-auto'}`}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
            {/* Cerrar drawer — solo móvil */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="md:hidden ml-auto p-3 -mr-3 rounded-lg text-white/40 hover:text-gold hover:bg-white/5 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden ${effectiveCollapsed ? 'px-2' : 'px-3'}`}>
          <div>
            {!effectiveCollapsed ? (
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Overview
              </p>
            ) : (
              <div className="my-3 mx-2 h-px bg-white/10 first:hidden" />
            )}
            {OVERVIEW_ITEMS.map(renderItem)}
          </div>
          <div className="mt-2 pt-3 border-t border-white/10">
            {!effectiveCollapsed ? (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Management
              </p>
            ) : (
              <div className="my-3 mx-2 h-px bg-white/10" />
            )}
            {MANAGEMENT_ITEMS.map(renderItem)}
          </div>
        </nav>

        {/* Perfil del usuario + sesión — al pie del sidebar */}
        <div className={`py-4 border-t border-white/10 ${effectiveCollapsed ? 'px-2' : 'px-3'}`}>
          {effectiveCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div
                title={`${userName} · ${userEmail}`}
                className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center"
              >
                <span className="text-[10px] font-semibold text-gold">{initials || 'U'}</span>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Sign out"
                  aria-label="Sign out"
                  className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-gold">{initials || 'U'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{userName}</p>
                  <p className="text-[11px] text-white/40 truncate">{userEmail}</p>
                </div>
              </div>
              <div className="mt-3 px-1 flex items-center justify-between gap-2">
                <LanguageSwitcher current={locale} variant="dark" openUp />
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-red-400 transition-colors"
                  >
                    <LogOut size={12} />
                    Sign out
                  </button>
                </form>
              </div>
              <p className="mt-3 pt-3 border-t border-white/10 text-[9px] uppercase tracking-[0.18em] text-white/25 text-center">
                {brand.name} · Powered by
                <a
                  href="https://digitalconnectdr.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-gold/60 hover:text-gold transition-colors"
                >
                  {brand.poweredBy}
                </a>
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
