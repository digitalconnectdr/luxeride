// ── Reporta presencia "en servicio" (independiente de un viaje activo) ────────
// Para que el Dispatch Board vea TODA la flota disponible, no solo los
// conductores con un viaje en curso (eso ya lo cubre useDriverLocationReporter,
// vía trip_locations). Escribe directo a driver_presence (RLS: el conductor
// puede upsert/leer/borrar SOLO su propia fila, sin pasar por una ruta API).
//
// Se auto-gestiona: revisa cada 30s si el conductor sigue "en servicio"
// (drivers.is_available) y arranca/detiene el watch de GPS según corresponda.
// Igual que el reporte por-viaje, esto SOLO funciona con la app en primer
// plano — ver limitación documentada en docs/PHASE-2-MOBILE.md.

import { useEffect } from 'react'
import * as Location from 'expo-location'
import { supabase } from './supabase'

const CHECK_INTERVAL_MS = 30_000
const SEND_THROTTLE_MS = 20_000

export function useDriverPresenceReporter() {
  useEffect(() => {
    let cancelled = false
    let watchSub: Location.LocationSubscription | null = null
    let lastSentAt = 0
    let driverId: string | null = null
    let companyId: string | null = null

    async function ensureWatching() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      driverId = user.id

      const { data } = await supabase.from('drivers').select('is_available, company_id').eq('id', user.id).maybeSingle()
      if (!data?.is_available) {
        watchSub?.remove()
        watchSub = null
        return
      }
      companyId = data.company_id
      if (watchSub) return // ya está observando

      const perm = await Location.requestForegroundPermissionsAsync()
      if (perm.status !== 'granted' || cancelled) return

      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: SEND_THROTTLE_MS, distanceInterval: 30 },
        (pos) => {
          const now = Date.now()
          if (now - lastSentAt < SEND_THROTTLE_MS) return
          lastSentAt = now
          if (!driverId || !companyId) return
          supabase.from('driver_presence').upsert({
            driver_id: driverId,
            company_id: companyId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            updated_at: new Date().toISOString(),
          })
        },
      )
    }

    ensureWatching()
    const interval = setInterval(ensureWatching, CHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
      watchSub?.remove()
    }
  }, [])
}
