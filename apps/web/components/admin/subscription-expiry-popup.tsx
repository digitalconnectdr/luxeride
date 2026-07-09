'use client'
// ── Popup de estado de suscripción ─────────────────────────────────────────────
// Aparece UNA vez por sesión de navegador (sessionStorage, no en cada
// navegación dentro del panel). Dos disparadores independientes:
// (a) la cuenta está suspendida AHORA MISMO (company.status === 'suspended'),
//     sin importar la fecha de subscription_ends_at — puede estar suspendida
//     con una fecha de renovación futura si el pago falló o fue desactivada
//     manualmente; o
// (b) al dueño le quedan ≤5 días de subscription_ends_at (o ya venció).
// Se auto-cierra a los 15s.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, AlertTriangle } from 'lucide-react'

export interface SubscriptionExpiryPopupLabels {
  expiringSoon: string // con placeholder {days}
  expiringToday: string
  expired: string
  suspended: string
  cta: string
  close: string
}

const EXIT_MS = 200

export function SubscriptionExpiryPopup({
  companyId,
  daysLeft,
  suspended,
  labels,
}: {
  companyId: string
  daysLeft: number | null
  suspended: boolean
  labels: SubscriptionExpiryPopupLabels
}) {
  const [visible, setVisible] = useState(false)
  const [entered, setEntered] = useState(false)
  const storageKey = `luxeride_subscription_popup_dismissed_${companyId}`

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey)) return
    } catch {
      // sessionStorage no disponible — se muestra igual, sin recordar
    }
    setVisible(true)
    const raf = requestAnimationFrame(() => setEntered(true))
    const timer = setTimeout(() => dismiss(), 15000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setEntered(false)
    setTimeout(() => setVisible(false), EXIT_MS)
    try {
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // sin persistencia — puede reaparecer en otra pestaña, no es grave
    }
  }

  if (!visible) return null

  // La suspensión manda sobre cualquier lectura de fecha — una cuenta puede
  // estar suspendida (pago fallido, bloqueo manual) con una fecha de
  // renovación todavía futura.
  const isExpired = !suspended && daysLeft !== null && daysLeft < 0
  const isUrgent = suspended || isExpired
  const message = suspended
    ? labels.suspended
    : isExpired
    ? labels.expired
    : daysLeft === 0
    ? labels.expiringToday
    : labels.expiringSoon.replace('{days}', String(daysLeft))

  return (
    <div
      role="alert"
      className={`fixed bottom-5 right-5 z-[300] w-[21rem] rounded-2xl bg-[#1d1b18] text-[#f5f2ec] shadow-2xl ring-1 ring-black/10 p-4 transition-all duration-300 ease-out motion-reduce:transition-none ${
        entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid place-items-center w-8 h-8 shrink-0 rounded-full ${
            isUrgent ? 'bg-red-500/15 text-red-400' : 'bg-[#e9c176]/15 text-[#e9c176]'
          }`}
        >
          {isUrgent ? (
            <AlertTriangle className="w-4 h-4" strokeWidth={2} />
          ) : (
            <Clock className="w-4 h-4" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm leading-snug">{message}</p>
          <Link
            href="/admin/settings#subscription"
            onClick={dismiss}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#e9c176] hover:text-[#e9c176]/80 transition-colors"
          >
            {labels.cta}
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.close}
          className="shrink-0 leading-none text-lg text-[#f5f2ec]/40 hover:text-[#f5f2ec] transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  )
}
