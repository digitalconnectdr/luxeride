'use client'
// ── Reporta la posición del conductor mientras el viaje está activo ───────────
// Sin UI propia (return null): solo efectos. Usa watchPosition (más eficiente
// en batería que un intervalo) y limita el envío al servidor a ~1 vez cada
// 8-10s. Si el conductor sale de la pestaña (Page Visibility API — p.ej. abre
// Waze) y vuelve, muestra un aviso: la posición dejó de compartirse mientras
// estuvo fuera. Limitación conocida de la PWA (no bloqueante): en segundo
// plano, especialmente en iOS Safari, el rastreo puede pausarse — se resuelve
// del todo solo con la app nativa (Fase 2B), por ahora seguimos con la PWA.

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { reportDriverLocationAction } from '@/app/actions/live-tracking'

const SEND_THROTTLE_MS = 8_000

const ACTIVE_STATUSES = new Set(['assigned', 'en_route', 'arrived', 'in_progress'])

export function LiveLocationReporter({
  bookingId,
  status,
  pauseNotice,
}: {
  bookingId: string
  status: string
  pauseNotice: string
}) {
  const active = ACTIVE_STATUSES.has(status)
  const wasHiddenRef = useRef(false)
  const everReportedRef = useRef(false)

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.geolocation) return

    let lastSentAt = 0
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentAt < SEND_THROTTLE_MS) return
        lastSentAt = now
        everReportedRef.current = true
        reportDriverLocationAction(bookingId, pos.coords.latitude, pos.coords.longitude)
      },
      () => { /* permiso denegado o GPS no disponible: no interrumpe el resto de la app */ },
      { enableHighAccuracy: true, maximumAge: 8_000 },
    )

    function onVisibilityChange() {
      if (document.hidden) {
        wasHiddenRef.current = true
      } else if (wasHiddenRef.current && everReportedRef.current) {
        wasHiddenRef.current = false
        toast(pauseNotice)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [active, bookingId, pauseNotice])

  return null
}
