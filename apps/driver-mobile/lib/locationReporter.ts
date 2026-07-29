// ── Reporta la posición del conductor mientras el viaje está activo ───────────
// Equivalente nativo de apps/web/components/driver/live-location-reporter.tsx:
// mismo umbral de envío (~8s) y misma lista de estados activos, para que el
// mapa en vivo del pasajero (/track/[id]) funcione igual sin importar si el
// conductor usa la web o esta app.
//
// A diferencia de la PWA (que no tiene forma de reportar fuera de la
// pestaña activa), esta app SÍ puede seguir reportando con la pantalla
// apagada o en segundo plano — típico cuando el conductor navega con
// Waze/Google Maps durante el viaje — usando background location de
// expo-location (ver backgroundLocationTask.ts). Eso requiere el permiso
// "Permitir siempre"; si el conductor no lo concede, se cae de vuelta al
// watchPositionAsync de primer plano de siempre, sin romper nada.

import { useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { callDriverApi } from './api'
import { BACKGROUND_LOCATION_TASK, ACTIVE_TRIP_STORAGE_KEY } from './backgroundLocationTask'
import { ACTIVE_STATUSES, type BookingStatus } from './types'

const SEND_THROTTLE_MS = 8_000

export function useDriverLocationReporter(bookingId: string, status: BookingStatus) {
  const active = !!bookingId && ACTIVE_STATUSES.includes(status)
  const [pauseNotice, setPauseNotice] = useState(false)
  const [backgroundUnavailable, setBackgroundUnavailable] = useState(false)
  const wasBackgroundRef = useRef(false)
  const everReportedRef = useRef(false)
  const backgroundActiveRef = useRef(false)
  // Marcado por openSettingsForBackground() cuando el conductor toca el
  // banner de "Permitir siempre" — al volver a la app se reintenta el
  // permiso una vez, en vez de quedarse en modo foreground para siempre
  // aunque el conductor sí lo haya concedido en Configuración.
  const settingsOpenedRef = useRef(false)

  // Mantiene AsyncStorage al día con el viaje/estado activo en cada cambio,
  // sin reiniciar la suscripción de ubicación de abajo — la tarea de
  // background lee esto en cada posición que recibe, y no puede leer
  // useState porque corre fuera del árbol de React.
  useEffect(() => {
    if (!active) return
    AsyncStorage.setItem(ACTIVE_TRIP_STORAGE_KEY, JSON.stringify({ bookingId, status }))
  }, [active, bookingId, status])

  useEffect(() => {
    if (!active) return

    let subscription: Location.LocationSubscription | null = null
    let lastSentAt = 0
    let cancelled = false

    // Intenta activar el tracking de background. Se llama al arrancar y de
    // nuevo cada vez que el conductor vuelve de Configuración habiendo
    // tocado el banner — por eso vive aparte de `start()`, no inline.
    // Revisa `cancelled` después de CADA await: `requestBackgroundPermissionsAsync`
    // puede tardar (en Android 11+ suele mandar al conductor a Configuración
    // y el promise queda pendiente mientras tanto), y si el efecto ya se
    // limpió para entonces (viaje completado, pantalla desmontada, otro
    // bookingId) no hay que dejar nada corriendo con datos obsoletos.
    async function tryStartBackground(): Promise<boolean> {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
      if (cancelled || bgStatus !== 'granted') return false

      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)
      if (cancelled) return false

      if (!alreadyRunning) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: SEND_THROTTLE_MS,
          distanceInterval: 15,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'LuxeRide Conductor',
            notificationBody: 'Compartiendo tu ubicación con el pasajero',
          },
        })
      }
      if (cancelled) {
        Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {})
        return false
      }

      backgroundActiveRef.current = true
      setBackgroundUnavailable(false)
      return true
    }

    async function startForegroundFallback() {
      if (cancelled) return
      backgroundActiveRef.current = false
      setBackgroundUnavailable(true)

      const sub = await Location.watchPositionAsync(
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
      if (cancelled) {
        sub.remove()
        return
      }
      subscription = sub
    }

    async function start() {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
      if (fgStatus !== 'granted' || cancelled) return

      const gotBackground = await tryStartBackground()
      if (!gotBackground && !cancelled) await startForegroundFallback()
    }
    start()

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (backgroundActiveRef.current) return

      if (next !== 'active') {
        wasBackgroundRef.current = true
        return
      }
      if (wasBackgroundRef.current && everReportedRef.current) {
        wasBackgroundRef.current = false
        setPauseNotice(true)
      }

      // Volvió a la app en modo fallback: si tocó el banner y fue a
      // Configuración, reintenta el permiso de background ahora.
      if (settingsOpenedRef.current) {
        settingsOpenedRef.current = false
        tryStartBackground().then((ok) => {
          if (ok) {
            subscription?.remove()
            subscription = null
          }
        })
      }
    })

    return () => {
      cancelled = true
      subscription?.remove()
      appStateSub.remove()
      if (backgroundActiveRef.current) {
        Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {})
        backgroundActiveRef.current = false
      }
      AsyncStorage.removeItem(ACTIVE_TRIP_STORAGE_KEY)
    }
  }, [active, bookingId])

  return {
    pauseNotice,
    dismissPauseNotice: () => setPauseNotice(false),
    backgroundUnavailable,
    // El banner llama esto en vez de Linking.openSettings() directo, para
    // que al volver se reintente el permiso en vez de quedarse en
    // foreground-only aunque el conductor sí lo haya concedido.
    openSettingsForBackground: () => {
      settingsOpenedRef.current = true
      Linking.openSettings()
    },
  }
}
