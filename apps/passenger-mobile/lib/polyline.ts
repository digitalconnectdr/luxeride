// ── Decodificador de encoded polyline (algoritmo estándar de Google) ──────
// bookings.route_polyline ya viene calculado y persistido por el servidor
// (Routes API, ver apps/web/lib/maps/routes.ts) — esto solo lo decodifica
// para dibujarlo en el mapa nativo, sin volver a llamar ninguna API.

export interface LatLng {
  latitude: number
  longitude: number
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }

  return points
}
