'use client'
// ── Campana de notificaciones (super-admin) — mezcla solicitudes recientes de
// feature_requests, activaciones recientes de company_addons y empresas
// nuevas registradas en una sola lista de los últimos 7 días (ver
// app/super-admin/layout.tsx, que también calcula `isNew` comparando cada
// timestamp contra `super_admin_notification_reads.last_seen_at`). Al abrir
// el panel se marca todo como visto -- en DB (persiste entre sesiones/
// recargas, vía markSuperAdminNotificationsSeenAction) y al instante en la
// UI (sin esperar la respuesta del server) para que el punto rojo no vuelva
// a aparecer como si fuera nuevo la próxima vez que se abra.

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, Lightbulb, ShoppingBag, Building2 } from 'lucide-react'
import { markSuperAdminNotificationsSeenAction } from '@/app/actions/notifications'

export interface NotificationItem {
  id: string
  kind: 'feature_request' | 'addon_purchase' | 'company_signup'
  title: string
  companyName: string | null
  companyId: string | null
  timestamp: string
  isNew: boolean
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function NotificationsBell({ items, pendingCount }: { items: NotificationItem[]; pendingCount: number }) {
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

  // Abrir el panel = visto. Una sola vez por sesión de componente (no en
  // cada toggle) para no repetir el mismo write de más.
  useEffect(() => {
    if (!open || markedRef.current) return
    markedRef.current = true
    setSeenThisSession(true)
    startTransition(() => {
      markSuperAdminNotificationsSeenAction()
    })
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
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
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">Notificaciones</p>
              <p className="text-[10px] text-sl-on-surface-muted/70 mt-0.5">Últimos 7 días</p>
            </div>
            {effectivePendingCount > 0 && (
              <span className="text-[10px] font-semibold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                {effectivePendingCount} nueva{effectivePendingCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-sl-on-surface-muted text-center">Sin notificaciones en los últimos 7 días.</p>
          ) : (
            <ul className="divide-y divide-sl-outline-variant">
              {items.map((item) => {
                const showAsNew = item.isNew && !seenThisSession
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      href={
                        item.kind === 'feature_request'
                          ? '/super-admin/feature-requests'
                          : item.companyId
                            ? `/super-admin/companies/${item.companyId}`
                            : '/super-admin/companies'
                      }
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-sl-bg ${showAsNew ? 'bg-gold/5' : ''}`}
                    >
                      {item.kind === 'feature_request' ? (
                        <Lightbulb size={14} className="text-bronze shrink-0 mt-0.5" />
                      ) : item.kind === 'addon_purchase' ? (
                        <ShoppingBag size={14} className="text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <Building2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${showAsNew ? 'text-sl-on-surface font-medium' : 'text-sl-on-surface-muted'}`}>
                          {item.title}
                        </p>
                        <p className="text-[11px] text-sl-on-surface-muted truncate">
                          {item.companyName ?? '—'} · {fmtDate(item.timestamp)}
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
