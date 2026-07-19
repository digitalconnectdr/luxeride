import { requireRole } from '@/lib/auth/session'
import { getLocale } from '@/lib/i18n/server'
import { createAdminClient } from '@/lib/supabase/server'
import { SuperAdminSidebar } from '@/components/super-admin/sidebar'
import { SuperAdminTopBar } from '@/components/super-admin/topbar'
import type { NotificationItem } from '@/components/super-admin/notifications-bell'

// Ventana de historial de la campana -- más allá de esto ya no importa,
// evita que la lista crezca sin límite. El punto rojo, en cambio, se basa en
// last_seen_at (ver más abajo), no en esta ventana.
const NOTIFICATION_HISTORY_DAYS = 7

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

type CompanyRow = {
  id: string
  name: string
  created_at: string
}

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('super_admin')
  const locale = getLocale()

  const admin = createAdminClient()
  const historySince = new Date(Date.now() - NOTIFICATION_HISTORY_DAYS * 86_400_000).toISOString()

  const [{ data: frData }, { data: addonData }, { data: companyData }, { data: readRow }] = await Promise.all([
    admin
      .from('feature_requests')
      .select('id, type, title, created_at, companies(name)')
      .gte('created_at', historySince)
      .order('created_at', { ascending: false }),
    admin
      .from('company_addons')
      .select('id, addon_key, enabled_at, company_id, companies(name)')
      .eq('enabled', true)
      .gte('enabled_at', historySince)
      .order('enabled_at', { ascending: false }),
    admin
      .from('companies')
      .select('id, name, created_at')
      .gte('created_at', historySince)
      .order('created_at', { ascending: false }),
    admin
      .from('super_admin_notification_reads')
      .select('last_seen_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  // Sin fila todavía (primera vez que este super-admin usa la campana): todo
  // el historial de 7 días cuenta como "nuevo" hasta que la abra una vez.
  const lastSeenAt = readRow?.last_seen_at ? new Date(readRow.last_seen_at).getTime() : 0

  const isNew = (timestamp: string) => new Date(timestamp).getTime() > lastSeenAt

  const frItems: NotificationItem[] = ((frData ?? []) as unknown as FrRow[]).map((r) => ({
    id: r.id,
    kind: 'feature_request',
    title: `${r.type === 'feature' ? 'Función' : 'Problema'}: ${r.title}`,
    companyName: r.companies?.name ?? null,
    companyId: null,
    timestamp: r.created_at,
    isNew: isNew(r.created_at),
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
      isNew: isNew(r.enabled_at),
    }))

  const companyItems: NotificationItem[] = ((companyData ?? []) as unknown as CompanyRow[]).map((c) => ({
    id: c.id,
    kind: 'company_signup',
    title: `Nueva empresa: ${c.name}`,
    companyName: c.name,
    companyId: c.id,
    timestamp: c.created_at,
    isNew: isNew(c.created_at),
  }))

  // Sin límite fijo de cantidad -- ya viene acotado por la ventana de 7 días
  // arriba; este tope es solo un resguardo ante un pico inusual de actividad.
  const notifications = [...frItems, ...addonItems, ...companyItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 30)
  const pendingCount = notifications.filter((n) => n.isNew).length

  const userName = `${user.profile.first_name} ${user.profile.last_name}`
  const userInitials = [user.profile.first_name, user.profile.last_name]
    .map((p) => p?.[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-sl-bg flex flex-col md:flex-row">
      <SuperAdminSidebar
        userName={userName}
        userEmail={user.email}
        locale={locale}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <SuperAdminTopBar
          locale={locale}
          notifications={notifications}
          pendingCount={pendingCount}
          userName={userName}
          userInitials={userInitials || 'SA'}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
