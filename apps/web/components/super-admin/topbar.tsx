// ── Barra superior del super-admin — notificaciones + idioma + cuenta. Server
// component: compone client components, no necesita estado propio.
import Link from 'next/link'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { NotificationsBell, type NotificationItem } from '@/components/super-admin/notifications-bell'
import type { Locale } from '@/lib/i18n/config'

export function SuperAdminTopBar({
  locale,
  notifications,
  pendingCount,
  userName,
  userInitials,
}: {
  locale: Locale
  notifications: NotificationItem[]
  pendingCount: number
  userName: string
  userInitials: string
}) {
  return (
    <header className="hidden md:flex items-center justify-end gap-1 px-6 py-2.5 bg-white border-b border-sl-outline-variant">
      <NotificationsBell items={notifications} pendingCount={pendingCount} />
      <LanguageSwitcher current={locale} variant="light" />
      <Link
        href="/super-admin/settings"
        title={userName}
        className="ml-1.5 w-8 h-8 rounded-full bg-[#1a1613] flex items-center justify-center text-white text-[11px] font-semibold hover:opacity-80 transition-opacity shrink-0"
      >
        {userInitials || 'SA'}
      </Link>
    </header>
  )
}
