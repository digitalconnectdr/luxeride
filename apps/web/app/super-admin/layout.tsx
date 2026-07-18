import { requireRole } from '@/lib/auth/session'
import { getLocale } from '@/lib/i18n/server'
import { createAdminClient } from '@/lib/supabase/server'
import { SuperAdminSidebar } from '@/components/super-admin/sidebar'
import { SuperAdminTopBar } from '@/components/super-admin/topbar'
import type { NotificationItem } from '@/components/super-admin/notifications-bell'
import type { FeatureRequestStatus } from '@/lib/supabase/database.types'

// Etiquetas legibles para company_addons.addon_key en la campana de
// notificaciones -- el super-admin no usa el diccionario i18n (ver
// components/super-admin/sidebar.tsx, nav en español fijo), así que se
// mantiene el mismo criterio aquí.
const ADDON_LABELS: Record<string, string> = {
  driver_payroll: 'Nómina de conductores',
  esignature: 'Firma electrónica',
  promo_codes: 'Códigos promocionales',
  ai_chat_basic: 'Asistente IA · Básico',
  ai_chat_plus: 'Asistente IA · Plus',
  ai_growth_basic: 'AI Growth Assistant · Básico',
  ai_growth_plus: 'AI Growth Assistant · Plus',
}

type FrRow = {
  id: string
  type: 'feature' | 'bug'
  title: string
  created_at: string
  companies: { name: string } | null
}

type AddonRow = {
  id: string
  addon_key: string
  enabled_at: string | null
  company_id: string
  companies: { name: string } | null
}

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('super_admin')
  const locale = getLocale()

  const admin = createAdminClient()
  const [{ data: frData }, { data: addonData }, { count: pendingCount }] = await Promise.all([
    admin
      .from('feature_requests')
      .select('id, type, title, created_at, companies(name)')
      .order('created_at', { ascending: false })
      .limit(8),
    admin
      .from('company_addons')
      .select('id, addon_key, enabled_at, company_id, companies(name)')
      .eq('enabled', true)
      .order('enabled_at', { ascending: false })
      .limit(8),
    admin
      .from('feature_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted' satisfies FeatureRequestStatus),
  ])

  const frItems: NotificationItem[] = ((frData ?? []) as unknown as FrRow[]).map((r) => ({
    id: r.id,
    kind: 'feature_request',
    title: `${r.type === 'feature' ? 'Función' : 'Problema'}: ${r.title}`,
    companyName: r.companies?.name ?? null,
    companyId: null,
    timestamp: r.created_at,
  }))

  const addonItems: NotificationItem[] = ((addonData ?? []) as unknown as AddonRow[])
    .filter((r): r is AddonRow & { enabled_at: string } => r.enabled_at != null)
    .map((r) => ({
      id: r.id,
      kind: 'addon_purchase',
      title: `Activó ${ADDON_LABELS[r.addon_key] ?? r.addon_key}`,
      companyName: r.companies?.name ?? null,
      companyId: r.company_id,
      timestamp: r.enabled_at,
    }))

  const notifications = [...frItems, ...addonItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  return (
    <div className="min-h-screen bg-sl-bg flex flex-col md:flex-row">
      <SuperAdminSidebar
        userName={`${user.profile.first_name} ${user.profile.last_name}`}
        userEmail={user.email}
        locale={locale}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <SuperAdminTopBar locale={locale} notifications={notifications} pendingCount={pendingCount ?? 0} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
