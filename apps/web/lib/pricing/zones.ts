// ── Resolución de zona por punto (puro, testeable) ─────────────────────────────
// Una zona se puede definir de dos formas (no excluyentes): una lista de
// códigos postales (estilo Moovs — simple, exacto, ideal cuando el mercado
// usa códigos postales como unidad de territorio) o un círculo (centro +
// radio en millas — más preciso para sectores dentro de una misma ciudad).
// Precedencia: código postal primero (si el punto trae uno y coincide con
// alguna zona), círculo como respaldo. Si varias zonas compiten, gana la
// MÁS ESPECÍFICA: menos códigos postales listados, o el radio más chico.

export interface ServiceZoneForMatch {
  id: string
  postal_codes: string[] | null
  center_lat: number | null
  center_lng: number | null
  radius_miles: number | null
}

export interface PointForZoneMatch {
  lat: number
  lng: number
  postalCode?: string | null
}

const EARTH_RADIUS_MILES = 3958.8

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a))
}

/**
 * Devuelve el id de la zona a la que pertenece un punto, o null si no cae en
 * ninguna. `zones` debe venir ya filtrada a las zonas activas de la empresa.
 */
export function resolveZoneId(zones: ServiceZoneForMatch[], point: PointForZoneMatch): string | null {
  if (point.postalCode) {
    const postalMatches = zones.filter((z) => (z.postal_codes ?? []).includes(point.postalCode!))
    if (postalMatches.length) {
      // Más específica = menos códigos postales agrupados en la zona.
      postalMatches.sort((a, b) => (a.postal_codes?.length ?? 0) - (b.postal_codes?.length ?? 0))
      return postalMatches[0].id
    }
  }

  const circleMatches = zones.filter(
    (z) =>
      z.center_lat != null &&
      z.center_lng != null &&
      z.radius_miles != null &&
      haversineMiles(point.lat, point.lng, z.center_lat, z.center_lng) <= z.radius_miles,
  )
  if (circleMatches.length) {
    // Más específica = radio más chico.
    circleMatches.sort((a, b) => (a.radius_miles ?? Infinity) - (b.radius_miles ?? Infinity))
    return circleMatches[0].id
  }

  return null
}
