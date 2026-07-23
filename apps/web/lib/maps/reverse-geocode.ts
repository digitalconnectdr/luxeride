// ── Reverse geocoding — ciudad/país por lat/lng ────────────────────────────
// Seguro: se ejecuta solo en Server Actions / Route Handlers (mismo
// principio que lib/maps/routes.ts). Usa la key de servidor, que ya tiene
// Geocoding API habilitada (compartida con el cálculo de rutas). Alimenta
// el reporte de rutas frecuentes del add-on AI Growth Assistant.

import { createAdminClient } from '@/lib/supabase/server'

export interface ReverseGeocodeResult {
  city: string | null
  country: string | null
}

interface AddressComponent {
  long_name: string
  types: string[]
}

function pickComponent(components: AddressComponent[], ...types: string[]): string | null {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type))
    if (match) return match.long_name
  }
  return null
}

/**
 * Resuelve ciudad y país a partir de coordenadas.
 * @returns null si la key no está configurada o hubo error — nunca lanza.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!apiKey || apiKey === 'placeholder') {
    console.warn('[Maps] GOOGLE_MAPS_SERVER_KEY no configurado | omitiendo reverse geocoding')
    return null
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('latlng', `${lat},${lng}`)
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      console.error('[Maps] Reverse Geocoding API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) return null

    // El primer resultado suele ser la dirección más específica; sus
    // address_components ya incluyen ciudad/país igual que los siguientes.
    const components: AddressComponent[] = data.results[0].address_components ?? []

    // 'locality' no existe en zonas rurales/fuera de ciudades grandes —
    // se cae a niveles administrativos más amplios en ese caso.
    const city = pickComponent(components, 'locality', 'administrative_area_level_2', 'administrative_area_level_1')
    const country = pickComponent(components, 'country')

    return { city, country }
  } catch (err) {
    console.error('[Maps] reverseGeocode error:', err)
    return null
  }
}

/**
 * Geocodifica origen y destino de una reserva y actualiza sus columnas
 * pickup_city/pickup_country/dropoff_city/dropoff_country. Fire-and-forget
 * (nunca lanza) — pensado para usarse con waitUntil() sin bloquear la
 * respuesta de creación de la reserva, igual que trackBookingFlight().
 */
export async function geocodeBookingLocations(
  bookingId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): Promise<void> {
  try {
    const [pickup, dropoff] = await Promise.all([
      reverseGeocode(pickupLat, pickupLng),
      reverseGeocode(dropoffLat, dropoffLng),
    ])
    if (!pickup && !dropoff) return

    const admin = createAdminClient()
    await admin
      .from('bookings')
      .update({
        pickup_city: pickup?.city ?? null,
        pickup_country: pickup?.country ?? null,
        dropoff_city: dropoff?.city ?? null,
        dropoff_country: dropoff?.country ?? null,
      })
      .eq('id', bookingId)
  } catch (err) {
    console.error('[geocodeBookingLocations]', err)
  }
}
