import type { Metadata } from 'next'
import { requireRole, getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { MapsProvider } from '@/components/maps/maps-provider'
import { getLocale, getDict } from '@/lib/i18n/server'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminTopBar } from '@/components/admin/topbar'
import { SidebarProvider } from '@/components/admin/sidebar-context'
import { SubscriptionExpiryPopup } from '@/components/admin/subscription-expiry-popup'
import { getTierForCount } from '@/lib/referrals/tiers'
import { getMarketplaceItems, type MarketplaceItemKey } from '@/lib/billing/catalog'
import type { CompanyPlan } from '@/lib/supabase/database.types'

const SUBSCRIPTION_WARNING_DAYS = 5

// PWA branded del back-office: el dueño/staff puede "instalar" su propio
// panel admin con el logo y color de SU empresa (mismo patrón que el
// micrositio del pasajero y el portal del conductor — ver /manifest/[slug]
// y /manifest/driver/[slug]).
export async function generateMetadata(): Promise<Metadata> {
  const meta: Metadata = { title: 'Admin' }
  try {
    const u = await getCurrentUser()
    if (u?.company_id) {
      const admin = createAdminClient()
      const { data: c } = await admin.from('companies').select('slug, logo_url').eq('id', u.company_id).single()
      if (c?.slug) {
        meta.manifest = `/manifest/admin/${c.slug}`
        meta.appleWebApp = { capable: true, statusBarStyle: 'default', title: 'Admin' }
        if (c.logo_url) meta.icons = { icon: [{ url: c.logo_url }], apple: [{ url: c.logo_url }] }
      }
    }
  } catch { /* sin sesión → metadata genérica */ }
  return meta
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole(
    'super_admin',
    'company_owner',
    'company_admin',
    'dispatcher',
    'accounting',
  )

  // Fetch company name + branding for sidebar header
  let companyName = 'Dashboard'
  let logoUrl: string | null = null
  let subscriptionDaysLeft: number | null = null
  let companyStatus: string | null = null
  let affiliateNetworkEnabled = false
  let isExternalAffiliate = false
  let primaryColor: string | null = null
  let companyPlan: CompanyPlan = 'starter'
  let visibleMarketplaceKeys: MarketplaceItemKey[] = []
  if (user.company_id) {
    try {
      const admin = createAdminClient()
      const [{ data, error }, { data: addonRows }] = await Promise.all([
        admin
          .from('companies')
          .select('name, logo_url, status, subscription_ends_at, affiliate_network_enabled, is_external_affiliate, primary_color, plan')
          .eq('id', user.company_id)
          .single(),
        admin
          .from('company_addons')
          .select('addon_key')
          .eq('company_id', user.company_id)
          .eq('enabled', true),
      ])
      if (error) {
        console.error('[admin/layout] companies query error:', JSON.stringify(error))
      } else if (data) {
        if (data.name) companyName = data.name
        logoUrl = (data as { logo_url?: string | null }).logo_url ?? null
        affiliateNetworkEnabled = data.affiliate_network_enabled
        isExternalAffiliate = data.is_external_affiliate
        primaryColor = data.primary_color
        companyStatus = data.status
        companyPlan = data.plan
        if (data.subscription_ends_at) {
          const msLeft = new Date(data.subscription_ends_at).getTime() - Date.now()
          subscriptionDaysLeft = Math.floor(msLeft / 86_400_000)
        }

        // ── Servicios adicionales activos — para ocultar del menu lo que la
        // empresa aun no ha comprado (ver lib/billing/catalog.ts). ──────────
        const enabledAddonKeys = new Set((addonRows ?? []).map((r) => r.addon_key))
        visibleMarketplaceKeys = getMarketplaceItems()
          .filter((item) => item.isActive({ plan: companyPlan, enabledAddonKeys, affiliateNetworkEnabled }))
          .map((item) => item.key)
      }
    } catch (err) {
      console.error('[admin/layout] companies query THREW:', err)
    }
  }

  const isOwner        = user.role === 'company_owner'
  const isOwnerOrAdmin = isOwner || user.role === 'company_admin'
  const isDispatcher   = user.role === 'dispatcher'
  const isAccounting   = user.role === 'accounting'

  // Nivel del programa de referidos — solo el owner lo gestiona/ve.
  let referralTier: { key: string; count: number } | null = null
  if (isOwner && user.company_id) {
    const admin = createAdminClient()
    const { count } = await admin
      .from('company_referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_company_id', user.company_id)
      .gt('expires_at', new Date().toISOString())
    const tier = getTierForCount(count ?? 0)
    if (tier) referralTier = { key: tier.key, count: count ?? 0 }
  }

  const locale = getLocale()
  const dict = getDict(locale)
  const nav = dict.adminNav
  const settingsDict = dict.admin.settings
  const referralsDict = dict.admin.referrals
  const isSuspended = companyStatus === 'suspended'
  const showSubscriptionPopup =
    isOwner &&
    (isSuspended || (subscriptionDaysLeft !== null && subscriptionDaysLeft <= SUBSCRIPTION_WARNING_DAYS))

  const userName = `${user.profile.first_name} ${user.profile.last_name}`
  const userInitials = userName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="min-h-screen bg-sl-bg flex flex-col md:flex-row"
      style={primaryColor ? ({ '--color-bronze': primaryColor } as React.CSSProperties) : undefined}
    >
      <SidebarProvider>
        {/* ── Sidebar colapsable (client) ── */}
        <AdminSidebar
          companyName={companyName}
          logoUrl={logoUrl}
          roleLabel={user.role.replace(/_/g, ' ')}
          userName={userName}
          userEmail={user.email}
          locale={locale}
          nav={nav}
          flags={{ isOwner, isOwnerOrAdmin, isDispatcher, isAccounting, affiliateNetworkEnabled, isExternalAffiliate }}
          referralTier={referralTier}
          referralsDict={referralsDict}
          visibleMarketplaceKeys={visibleMarketplaceKeys}
          featureRequestLabels={dict.admin.featureRequest}
        />

        {/* ── Main — barra superior + contenido, envuelto en MapsProvider ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopBar userName={userName} userInitials={userInitials} featureRequestLabels={dict.admin.featureRequest} locale={locale} />
          <main className="flex-1 overflow-auto">
            <MapsProvider>{children}</MapsProvider>
          </main>
        </div>
      </SidebarProvider>

      {showSubscriptionPopup && user.company_id && (
        <SubscriptionExpiryPopup
          companyId={user.company_id}
          daysLeft={subscriptionDaysLeft}
          suspended={isSuspended}
          labels={{
            expiringSoon: settingsDict.subscriptionPopupExpiringSoon,
            expiringToday: settingsDict.subscriptionPopupExpiringToday,
            expired: settingsDict.subscriptionPopupExpired,
            suspended: settingsDict.subscriptionPopupSuspended,
            cta: settingsDict.subscriptionPopupCta,
            close: settingsDict.subscriptionPopupClose,
          }}
        />
      )}
    </div>
  )
}
