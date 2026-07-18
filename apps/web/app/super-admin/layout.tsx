import { requireRole } from '@/lib/auth/session'
import { getLocale } from '@/lib/i18n/server'
import { SuperAdminSidebar } from '@/components/super-admin/sidebar'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('super_admin')
  const locale = getLocale()

  return (
    <div className="min-h-screen bg-sl-bg flex flex-col md:flex-row">
      <SuperAdminSidebar
        userName={`${user.profile.first_name} ${user.profile.last_name}`}
        userEmail={user.email}
        locale={locale}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
