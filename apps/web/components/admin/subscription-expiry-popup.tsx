'use client'
// ── Popup de suscripción por vencer ────────────────────────────────────────────
// Aparece UNA vez por sesión de navegador (sessionStorage, no en cada
// navegación dentro del panel) cuando al dueño le quedan ≤10 días de
// subscription_ends_at (o ya venció). Se auto-cierra a los 15s.

import { useEffect, useState } from 'react'
import Link from 'next/link'

export interface SubscriptionExpiryPopupLabels {
  expiringSoon: string // con placeholder {days}
  expiringToday: string
  expired: string
  cta: string
  close: string
}

export function SubscriptionExpiryPopup({
  companyId,
  daysLeft,
  labels,
}: {
  companyId: string
  daysLeft: number
  labels: SubscriptionExpiryPopupLabels
}) {
  const [visible, setVisible] = useState(false)
  const storageKey = `luxeride_subscription_popup_dismissed_${companyId}`

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey)) return
    } catch {
      // sessionStorage no disponible — se muestra igual, sin recordar
    }
    setVisible(true)
    const timer = setTimeout(() => dismiss(), 15000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // sin persistencia — puede reaparecer en otra pestaña, no es grave
    }
  }

  if (!visible) return null

  const message = daysLeft < 0
    ? labels.expired
    : daysLeft === 0
    ? labels.expiringToday
    : labels.expiringSoon.replace('{days}', String(daysLeft))

  return (
    <div className="fixed bottom-5 right-5 z-[300] w-80 rounded-xl bg-[#1d1b18] text-[#f5f2ec] shadow-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-snug">{message}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.close}
          className="text-[#f5f2ec]/50 hover:text-[#f5f2ec] shrink-0 leading-none text-lg"
        >
          ×
        </button>
      </div>
      <Link
        href="/admin/settings"
        onClick={dismiss}
        className="mt-2 inline-block text-xs font-medium text-bronze hover:text-bronze/80"
      >
        {labels.cta}
      </Link>
    </div>
  )
}
