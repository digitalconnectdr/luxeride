// ── Cliente de autocomplete de direcciones ─────────────────────────────────
// Llama a las rutas server-side nuevas (/api/mobile/passenger/places-*),
// que a su vez usan la key de servidor de Google — la app nunca embebe una
// key de Places propia. `callPassengerApi` es seguro usarlo aquí aunque
// estas rutas no requieran sesión (el bearer se manda vacío si no hay).

import * as Crypto from 'expo-crypto'
import { callPassengerApi } from './api'

export interface PlacePrediction {
  placeId: string
  description: string
}

export interface PlaceDetails {
  address: string
  lat: number
  lng: number
  postalCode: string | null
}

/** Un token de sesión agrupa autocomplete+details para la facturación de
 *  Google (recomendado por su documentación) — uno nuevo por búsqueda. */
export function newPlacesSessionToken(): string {
  return Crypto.randomUUID()
}

export async function searchAddress(input: string, sessionToken: string): Promise<PlacePrediction[]> {
  if (!input.trim()) return []
  const result = await callPassengerApi<{ predictions?: PlacePrediction[] }>('places-autocomplete', {
    input,
    sessionToken,
  })
  return result.success ? (result.predictions ?? []) : []
}

export async function resolvePlace(placeId: string, sessionToken: string): Promise<PlaceDetails | null> {
  const result = await callPassengerApi<PlaceDetails>('places-details', { placeId, sessionToken })
  if (!result.success) return null
  return { address: result.address, lat: result.lat, lng: result.lng, postalCode: result.postalCode }
}
