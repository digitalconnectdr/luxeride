// ── Reporta la posición del conductor mientras el viaje está activo ───────────
// Equivalente nativo de apps/web/components/driver/live-location-reporter.tsx:
// mismo umbral de envío (~8s) y misma lista de estados activos, para que el
// mapa en vivo del pasajero (/track/[id]) funcione igual sin importar si el
// conductor usa la web o esta app.
//
// Limitación conocida (pendiente, documentada en docs/PHASE-2-MOBILE.md): esto
// SOLO reporta mientras la app está en primer plano — igual que la PWA, que
// también se pausa al cambiar de pestaña. Reportar con la app en segundo
// plano o el teléfono bloqueado requiere "background location" de
// expo-location, que exige un build nativo custom (no funciona en Expo Go) y
// permisos adicionales de Android/iOS — se deja para una fase posterior.

import { useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'
import { AppState, type AppStateStatus } from 'react-native'
import { callDriverApi } from './api'
import { ACTIVE_STATUSES, type BookingStatus } from './types'

const SEND_THROTTLE_MS = 8_000

export function useDriverLocationReporter(bookingId: string, status: BookingStatus) {
  const active = !!bookingId && ACTIVE_STATUSES.includes(status)
  const [pauseNotice, setPauseNotice] = useState(false)
  const wasBackgroundRef = useRef(false)
  const everReportedRef = useRef(false)

  useEffect(() => {
    if (!active) return

    let subscription: Location.LocationSubscription | null = null
    let lastSentAt = 0
    let cancelled = false

    async function start() {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync()
      if (permStatus !== 'granted' || cancelled) return

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: SEND_THROTTLE_MS, distanceInterval: 15 },
        (pos) => {
          const now = Date.now()
          if (now - lastSentAt < SEND_THROTTLE_MS) return
          lastSentAt = now
          everReportedRef.current = true
          callDriverApi('report-location', {
            bookingId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          })
        },
      )
    }
    start()

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') {
        wasBackgroundRef.current = true
      } else if (wasBackgroundRef.current && everReportedRef.current) {
        wasBackgroundRef.current = false
        setPauseNotice(true)
      }
    })

    return () => {
      cancelled = true
      subscription?.remove()
      appStateSub.remove()
    }
  }, [active, bookingId])

  return { pauseNotice, dismissPauseNotice: () => setPauseNotice(false) }
}
