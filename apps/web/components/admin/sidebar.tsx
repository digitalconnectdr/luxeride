'use client'
// ── Sidebar del admin — colapsable (solo íconos) para ganar espacio ───────────
// Fondo negro carbón de principio a fin (identidad premium): logo, nav y
// perfil de usuario viven todos sobre el mismo fondo oscuro. El estado de
// colapso/drawer móvil vive en SidebarContext (compartido con el TopBar).
// En modo colapsado se muestra tooltip nativo con el nombre de cada item.

import { useEffect } from 'react'
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
  Handshake,
  Percent,
  Wallet,
  FileSignature,
  Bot,
  TrendingUp,
  Store,
  Gauge,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Award,
  Gift,
  type LucideIcon,
} from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'
import { brand } from '@/lib/brand'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useSidebarState } from '@/components/admin/sidebar-context'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { ReferralTierKey } from '@/lib/referrals/tiers'

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
    affiliateNetworkEnabled: boolean
    isExternalAffiliate: boolean
  }
  referralTier?: { key: string; count: number } | null
  referralsDict?: Dictionary['admin']['referrals']
}

const REFERRAL_TIER_LABEL_KEY: Record<ReferralTierKey, keyof Dictionary['admin']['referrals']> = {
  iniciado: 'tierIniciado',
  socio: 'tierSocio',
  aliado: 'tierAliado',
  embajador: 'tierEmbajador',
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
  referralTier,
  referralsDict,
}: Props) {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState()

  // Cerrar el drawer móvil al navegar a otra página
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  // Afiliado externo (Sección G, Fase 2): solo participa de la Red de
  // Afiliados de quien lo invitó — no es cliente de LuxeRide, así que no
  // tiene reservas propias, dispatch, zonas, precios, ni compliance/reportes
  // internos que gestionar. Solo Flota (para registrar su conductor/vehículo
  // real), Afiliados (solicitudes entrantes) y Configuración (Whop Connect).
  const ext = flags.isExternalAffiliate

  const sections: NavSection[] = [
    {
      header: nav.overview,
      show: true,
      items: [
        { href: '/admin/dashboard', label: nav.dashboard, icon: LayoutDashboard },
        ...(ext ? [] : [{ href: '/admin/operator-score', label: nav.operatorScore, icon: Gauge }]),
      ],
    },
    {
      header: nav.operations,
      show: flags.isOwnerOrAdmin || flags.isDispatcher,
      items: [
        ...(ext ? [] : [{ href: '/dispatcher/dashboard', label: nav.dispatch, icon: RadioTower }]),
        { href: '/admin/fleet', label: nav.fleet, icon: Car },
        { href: '/admin/drivers', label: nav.drivers, icon: Users },
        { href: '/admin/affiliates', label: nav.affiliates, icon: Handshake },
      ],
    },
    {
      header: nav.geography,
      show: !ext && (flags.isOwnerOrAdmin || flags.isDispatcher),
      items: [
        { href: '/admin/zones', label: nav.zones, icon: MapPinned },
        { href: '/admin/airports', label: nav.airports, icon: Plane },
      ],
    },
    {
      header: nav.pricing,
      show: !ext && flags.isOwnerOrAdmin,
      items: [{ href: '/admin/pricing', label: nav.pricingRules, icon: Tags }],
    },
    {
      header: nav.bookings,
      show: !ext && (flags.isOwnerOrAdmin || flags.isDispatcher),
      items: [
        { href: '/admin/bookings', label: nav.reservations, icon: CalendarDays },
        { href: '/admin/quotes', label: nav.quotes, icon: FileText },
        { href: '/admin/messages', label: nav.messages, icon: MessageSquare },
        { href: '/admin/driver-reports', label: nav.driverReports, icon: AlertTriangle },
        ...(ext ? [] : [{ href: '/admin/promo-codes', label: nav.promoCodes, icon: Percent }]),
      ],
    },
    {
      header: nav.finance,
      show: !ext && (flags.isOwnerOrAdmin || flags.isAccounting),
      items: [
        { href: '/admin/reports', label: nav.reports, icon: BarChart3 },
        { href: '/admin/audit', label: nav.auditLog, icon: ScrollText },
        { href: '/admin/payroll', label: nav.payroll, icon: Wallet },
      ],
    },
    {
      header: nav.management,
      show: flags.isOwnerOrAdmin,
      items: [
        ...(ext ? [] : [
          { href: '/admin/corporate', label: nav.corporate, icon: Building2 },
          { href: '/admin/compliance', label: nav.compliance, icon: ShieldCheck },
        ]),
        { href: '/admin/team', label: nav.team, icon: UserCog },
        { href: '/admin/esignature', label: nav.esignature, icon: FileSignature },
        { href: '/admin/assistant', label: nav.assistant, icon: Bot },
        { href: '/admin/growth-assistant', label: nav.growthAssistant, icon: TrendingUp },
        { href: '/admin/partners', label: nav.partners, icon: Store },
        ...(flags.isOwner
          ? [
              { href: '/admin/referrals', label: nav.referrals, icon: Gift },
              { href: '/admin/settings', label: nav.settings, icon: Settings },
            ]
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

  const effectiveCollapsed = collapsed

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
        <span className="font-playfair text-sm font-semibold text-white truncate">
          {companyName}
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
        className={`fixed md:sticky md:top-0 inset-y-0 md:inset-y-auto left-0 z-50 md:z-auto w-72 md:h-screen ${effectiveCollapsed ? 'md:w-16' : 'md:w-56'} bg-[#1a1613] flex flex-col shrink-0 transition-transform md:transition-[width] duration-200 ease-out transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Wordmark + toggle — identidad de marca (logo + nombre + atribución) */}
        <div className={`py-6 border-b border-white/10 ${effectiveCollapsed ? 'px-0' : 'px-5'}`}>
          <div className={`flex items-center ${effectiveCollapsed ? 'flex-col gap-3' : 'justify-between gap-2'}`}>
            <Link
              href="/admin/dashboard"
              prefetch={false}
              title={nav.dashboard}
              className={`flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity ${effectiveCollapsed ? 'justify-center' : ''}`}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={companyName} className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-white/10" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center shrink-0">
                  <span className="text-gray-900 font-bold text-sm leading-none">
                    {companyName.trim().charAt(0).toUpperCase() || 'L'}
                  </span>
                </div>
              )}
              {!effectiveCollapsed && (
                <span className="font-playfair text-lg font-semibold text-white truncate leading-tight">
                  {companyName}
                </span>
              )}
            </Link>
            {/* Colapsar a íconos — solo desktop */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              title={collapsed ? 'Expandir' : 'Minimizar'}
              className="hidden md:block p-1 rounded-lg text-white/40 hover:text-gold hover:bg-white/5 transition-colors shrink-0"
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
            {/* Cerrar drawer — solo móvil */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="md:hidden p-3 -mr-3 rounded-lg text-white/40 hover:text-gold hover:bg-white/5 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!effectiveCollapsed && referralTier && referralsDict && (
          <div className="px-5 py-2.5 border-b border-white/10">
            <div
              title={`${referralTier.count} ${referralsDict.countLabel}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1"
            >
              <Award size={11} className="text-gold shrink-0" />
              <span className="text-[10px] font-semibold text-gold">
                {referralsDict[REFERRAL_TIER_LABEL_KEY[referralTier.key as ReferralTierKey]]}
              </span>
              <span className="text-[9px] text-white/40">
                · {referralTier.count} {referralsDict.countLabel}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden ${effectiveCollapsed ? 'px-2' : 'px-3'}`}>
          {sections.filter((s) => s.show).map((section, idx) => (
            <div
              key={section.header}
              className={!effectiveCollapsed && idx > 0 ? 'mt-2 pt-3 border-t border-white/10' : undefined}
            >
              {!effectiveCollapsed ? (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  {section.header}
                </p>
              ) : (
                <div className="my-3 mx-2 h-px bg-white/10 first:hidden" />
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
              })}
            </div>
          ))}
        </nav>

        {/* Tarjeta de perfil del usuario — identidad + sesión, al pie del sidebar */}
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
                <div
                  title={roleLabel}
                  className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0"
                >
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
