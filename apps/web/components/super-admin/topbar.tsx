// ── Barra superior del super-admin — notificaciones + idioma. Server
// component: compone dos client components, no necesita estado propio.
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { NotificationsBell, type NotificationItem } from '@/components/super-admin/notifications-bell'
import type { Locale } from '@/lib/i18n/config'

export function SuperAdminTopBar({
  locale,
  notifications,
  pendingCount,
}: {
  locale: Locale
  notifications: NotificationItem[]
  pendingCount: number
}) {
  return (
    <header className="hidden md:flex items-center justify-end gap-1 px-6 py-2.5 bg-white border-b border-sl-outline-variant">
      <NotificationsBell items={notifications} pendingCount={pendingCount} />
      <LanguageSwitcher current={locale} variant="light" />
    </header>
  )
}
