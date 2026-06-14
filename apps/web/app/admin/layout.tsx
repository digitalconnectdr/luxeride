import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { MapsProvider } from '@/components/maps/maps-provider'
import { getLocale, getDict } from '@/lib/i18n/server'
import { AdminSidebar } from '@/components/admin/sidebar'

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
  if (user.company_id) {
    try {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from('companies')
        .select('name, logo_url')
        .eq('id', user.company_id)
        .single()
      if (error) {
        console.error('[admin/layout] companies query error:', JSON.stringify(error))
      } else if (data) {
        if (data.name) companyName = data.name
        logoUrl = (data as { logo_url?: string | null }).logo_url ?? null
      }
    } catch (err) {
      console.error('[admin/layout] companies query THREW:', err)
    }
  }

  const isOwner        = user.role === 'company_owner'
  const isOwnerOrAdmin = isOwner || user.role === 'company_admin'
  const isDispatcher   = user.role === 'dispatcher'
  const isAccounting   = user.role === 'accounting'

  const locale = getLocale()
  const nav = getDict(locale).adminNav

  return (
    <div className="min-h-screen bg-sl-bg flex">
      {/* ── Sidebar colapsable (client) ── */}
      <AdminSidebar
        companyName={companyName}
        logoUrl={logoUrl}
        roleLabel={user.role.replace(/_/g, ' ')}
        userName={`${user.profile.first_name} ${user.profile.last_name}`}
        userEmail={user.email}
        locale={locale}
        nav={nav}
        flags={{ isOwner, isOwnerOrAdmin, isDispatcher, isAccounting }}
      />

      {/* ── Main — envuelto en MapsProvider para toda la sección admin ── */}
      <main className="flex-1 overflow-auto">
        <MapsProvider>{children}</MapsProvider>
      </main>
    </div>
  )
}
