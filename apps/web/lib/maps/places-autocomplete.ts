// ── Google Places Autocomplete/Details — proxy server-side ────────────────
// Seguro: se ejecuta solo en Route Handlers. Nunca exponer este módulo ni la
// key al cliente. Existe para que apps/passenger-mobile (app nativa) pueda
// ofrecer autocomplete de direcciones sin embeber una key de Places en el
// bundle de la app (a diferencia del browser, una app nativa no tiene
// protección de referrer HTTP — la key quedaría expuesta sin restricción
// real si se llamara directo desde el cliente). Mismo principio que
// lib/maps/routes.ts: "nunca exponer este módulo al cliente".

export interface PlacePrediction {
  placeId: string
  description: string
}

export interface PlaceDetailsResult {
  address: string
  lat: number
  lng: number
  postalCode: string | null
}

function getServerKey(): string | null {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!apiKey || apiKey === 'placeholder') {
    console.warn('[Maps] GOOGLE_MAPS_SERVER_KEY no configurado | omitiendo Places')
    return null
  }
  return apiKey
}

/**
 * Busca predicciones de direcciones para un texto libre.
 * Usa la Place Autocomplete API clásica (maps.googleapis.com/maps/api/place).
 */
export async function searchPlaceAutocomplete(
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  const apiKey = getServerKey()
  if (!apiKey || !input.trim()) return []

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    url.searchParams.set('input', input.trim())
    url.searchParams.set('sessiontoken', sessionToken)
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      console.error('[Maps] Places Autocomplete API error:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Maps] Places Autocomplete API status:', data.status, data.error_message)
      return []
    }

    return (data.predictions ?? []).map((p: { place_id: string; description: string }) => ({
      placeId: p.place_id,
      description: p.description,
    }))
  } catch (err) {
    console.error('[Maps] searchPlaceAutocomplete error:', err)
    return []
  }
}

/**
 * Resuelve un place_id a dirección formateada + lat/lng + código postal.
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetailsResult | null> {
  const apiKey = getServerKey()
  if (!apiKey || !placeId) return null

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('sessiontoken', sessionToken)
    url.searchParams.set('fields', 'formatted_address,geometry,address_components')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      console.error('[Maps] Place Details API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    if (data.status !== 'OK') {
      console.error('[Maps] Place Details API status:', data.status, data.error_message)
      return null
    }

    const result = data.result
    const location = result?.geometry?.location
    if (!location) return null

    const postalComponent = (result.address_components ?? []).find(
      (c: { types: string[] }) => c.types.includes('postal_code'),
    )

    return {
      address: result.formatted_address ?? '',
      lat: location.lat,
      lng: location.lng,
      postalCode: postalComponent?.long_name ?? null,
    }
  } catch (err) {
    console.error('[Maps] getPlaceDetails error:', err)
    return null
  }
}
