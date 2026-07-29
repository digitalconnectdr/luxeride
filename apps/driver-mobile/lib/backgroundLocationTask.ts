// ── Tarea de ubicación en segundo plano ───────────────────────────────────────
// Complementa a locationReporter.ts: mientras ese hook reporta con la app en
// primer plano, esta tarea la reemplaza cuando el conductor concede el
// permiso "Permitir siempre" — sigue entregando posiciones aunque la app
// esté en segundo plano (típico: el conductor navega con Waze/Google Maps)
// o el teléfono esté bloqueado.
//
// `TaskManager.defineTask` se registra a nivel de MÓDULO a propósito, no
// dentro de un componente ni un hook: el sistema operativo relanza el motor
// de JS en segundo plano sin montar el árbol de React, así que si el
// registro dependiera de un useEffect, la tarea no existiría cuando el SO
// intenta invocarla y la actualización se perdería en silencio. Por eso
// este archivo se importa una sola vez desde index.ts, antes de
// registerRootComponent.
//
// Como el callback corre fuera de React, no puede leer useState: el viaje
// activo (bookingId + status) se persiste en AsyncStorage desde
// locationReporter.ts, y esta tarea solo lo lee.

import * as TaskManager from 'expo-task-manager'
import type * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { callDriverApi } from './api'
import { ACTIVE_STATUSES, type BookingStatus } from './types'

export const BACKGROUND_LOCATION_TASK = 'luxeride-driver-location'
export const ACTIVE_TRIP_STORAGE_KEY = 'active-trip-tracking'

interface ActiveTrip {
  bookingId: string
  status: BookingStatus
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return

  const raw = await AsyncStorage.getItem(ACTIVE_TRIP_STORAGE_KEY)
  if (!raw) return

  let active: ActiveTrip
  try {
    active = JSON.parse(raw) as ActiveTrip
  } catch {
    return
  }
  if (!active.bookingId || !ACTIVE_STATUSES.includes(active.status)) return

  const { locations } = (data as { locations: Location.LocationObject[] }) ?? { locations: [] }
  const last = locations[locations.length - 1]
  if (!last) return

  await callDriverApi('report-location', {
    bookingId: active.bookingId,
    latitude: last.coords.latitude,
    longitude: last.coords.longitude,
  })
})
