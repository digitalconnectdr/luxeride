'use client'
// ── Barra superior del admin — controles globales (menú, mensajes,
// cumplimiento, ayuda, cuenta). Solo visible en desktop: en móvil la barra
// propia del sidebar ya cumple ese rol. Puramente de navegación — reutiliza
// páginas reales existentes, no inventa contadores ni datos.

import Link from 'next/link'
import { Menu, Bell, ShieldCheck, HelpCircle } from 'lucide-react'
import { useSidebarState } from '@/components/admin/sidebar-context'
import { FeatureRequestButton, type FeatureRequestLabels } from '@/components/admin/feature-request-modal'

interface Props {
  userName: string
  userInitials: string
  featureRequestLabels: FeatureRequestLabels
}

export function AdminTopBar({ userName, userInitials, featureRequestLabels }: Props) {
  const { toggleCollapsed } = useSidebarState()

  return (
    <header className="hidden md:flex items-center gap-1 px-6 py-2.5 bg-white border-b border-sl-outline-variant">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Toggle sidebar"
        title="Contraer / expandir menú"
        className="p-2 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors mr-auto"
      >
        <Menu size={18} />
      </button>

      <Link
        href="/admin/messages"
        title="Mensajes"
        className="p-2 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors"
      >
        <Bell size={18} />
      </Link>
      <Link
        href="/admin/compliance"
        title="Cumplimiento"
        className="p-2 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors"
      >
        <ShieldCheck size={18} />
      </Link>
      <Link
        href="/admin/help"
        title="Ayuda"
        className="p-2 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors"
      >
        <HelpCircle size={18} />
      </Link>
      <FeatureRequestButton labels={featureRequestLabels} />
      <Link
        href="/admin/settings"
        title={userName}
        className="ml-1.5 w-8 h-8 rounded-full bg-[#1a1613] flex items-center justify-center text-white text-[11px] font-semibold hover:opacity-80 transition-opacity shrink-0"
      >
        {userInitials || 'U'}
      </Link>
    </header>
  )
}
