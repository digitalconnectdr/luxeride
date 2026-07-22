'use client'
// ── Campana de notificaciones del panel admin ──────────────────────────────
// Lee de `admin_notifications` (una sola query indexada por company_id+
// created_at, ver app/admin/layout.tsx) — a diferencia de la campana del
// super-admin, los avisos aquí NO se calculan al vuelo en cada render: ya
// vienen insertados por el evento que ocurrió (reporte de conductor) o por
// el cron diario con deduplicación (mantenimiento de vehículo, alerta de
// compliance). Mismo patrón de leído/no-leído: al abrir el panel se marca
// visto en DB (persiste entre sesiones) y al instante en la UI.

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, AlertTriangle, Wrench, ShieldAlert } from 'lucide-react'
import { markAdminNotificationsSeenAction } from '@/app/actions/notifications'

export interface AdminNotificationItem {
  id: string
  type: string
  title: string
  detail: string | null
  href: string | null
  timestamp: string
  isNew: boolean
}

export interface NotificationsBellLabels {
  title: string
  historyLabel: string
  empty: string
  newLabel: string
}

const TYPE_ICON: Record<string, typeof AlertTriangle> = {
  driver_report: AlertTriangle,
  vehicle_maintenance: Wrench,
  compliance_alert: ShieldAlert,
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function NotificationsBell({
  items,
  pendingCount,
  labels,
}: {
  items: AdminNotificationItem[]
  pendingCount: number
  labels: NotificationsBellLabels
}) {
  const [open, setOpen] = useState(false)
  const [seenThisSession, setSeenThisSession] = useState(false)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const markedRef = useRef(false)

  const effectivePendingCount = seenThisSession ? 0 : pendingCount

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || markedRef.current) return
    markedRef.current = true
    setSeenThisSession(true)
    startTransition(() => {
      markAdminNotificationsSeenAction()
    })
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={labels.title}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-sl-on-surface-muted hover:text-bronze hover:bg-sl-bg transition-colors"
      >
        <Bell size={18} />
        {effectivePendingCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-sl-outline-variant bg-white shadow-[0_8px_30px_rgba(29,27,24,0.12)]">
          <div className="px-4 py-3 border-b border-sl-outline-variant flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{labels.title}</p>
              <p className="text-[10px] text-sl-on-surface-muted/70 mt-0.5">{labels.historyLabel}</p>
            </div>
            {effectivePendingCount > 0 && (
              <span className="text-[10px] font-semibold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                {effectivePendingCount} {labels.newLabel}
              </span>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-sl-on-surface-muted text-center">{labels.empty}</p>
          ) : (
            <ul className="divide-y divide-sl-outline-variant">
              {items.map((item) => {
                const showAsNew = item.isNew && !seenThisSession
                const Icon = TYPE_ICON[item.type] ?? AlertTriangle
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href ?? '#'}
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-sl-bg ${showAsNew ? 'bg-gold/5' : ''}`}
                    >
                      <Icon size={14} className="text-bronze shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${showAsNew ? 'text-sl-on-surface font-medium' : 'text-sl-on-surface-muted'}`}>
                          {item.title}
                        </p>
                        <p className="text-[11px] text-sl-on-surface-muted truncate">
                          {item.detail ?? ''}{item.detail ? ' · ' : ''}{fmtDate(item.timestamp)}
                        </p>
                      </div>
                      {showAsNew && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" aria-hidden />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
