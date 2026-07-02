// ── Construcción de la URL de Google Static Maps para el tracking ─────────────
// Compartido entre el pasajero (dark), el conductor (mapa embebido en tema
// Ivory, pero el estilo del MAPA en sí sigue siendo oscuro) y el refresco en
// vivo del lado cliente (LiveTrackingMap) — mismo estilo visual en los 3.

export interface LatLng { lat: number; lng: number }

const DARK_STYLE = [
  'feature:all|element:geometry|color:0x1a1a1d',
  'feature:all|element:labels.text.fill|color:0x9a9a9a',
  'feature:all|element:labels.text.stroke|color:0x131316',
  'feature:road|element:geometry|color:0x2c2c31',
  'feature:water|element:geometry|color:0x0e0e12',
  'feature:poi|visibility:off',
  'feature:transit|visibility:off',
].map((s) => `&style=${encodeURIComponent(s)}`).join('')

export function buildTripStaticMapUrl(opts: {
  pickup: LatLng
  dropoff: LatLng
  brandColor: string
  mapsKey: string
  driverPos?: LatLng | null
  passengerPos?: LatLng | null
  /** Trazado real de la ruta (encoded polyline de Google Routes API). Si no
   *  se provee (reservas viejas, o falló el cálculo), cae a una línea recta
   *  entre pickup y dropoff — nunca se rompe el mapa por falta de esto. */
  routePolyline?: string | null
  size?: string
}): string {
  const { pickup, dropoff, brandColor, mapsKey, driverPos, passengerPos, routePolyline, size = '600x280' } = opts
  const bc = brandColor.replace('#', '0x')
  const p = `${pickup.lat},${pickup.lng}`
  const d = `${dropoff.lat},${dropoff.lng}`

  let markers =
    `&markers=${encodeURIComponent(`size:mid|color:${bc}|label:A|${p}`)}` +
    `&markers=${encodeURIComponent(`size:mid|color:0xffffff|label:B|${d}`)}`

  // Marcador del conductor: verde, letra D — se agrega solo cuando ya hay una
  // posición en vivo reportada (viaje activo).
  if (driverPos) {
    markers += `&markers=${encodeURIComponent(`size:mid|color:0x22c55e|label:D|${driverPos.lat},${driverPos.lng}`)}`
  }
  // Marcador del pasajero: azul, letra P — solo si el pasajero activó
  // "compartir mi ubicación" (opt-in explícito, ver reportPassengerLocationAction).
  if (passengerPos) {
    markers += `&markers=${encodeURIComponent(`size:mid|color:0x3b82f6|label:P|${passengerPos.lat},${passengerPos.lng}`)}`
  }

  // Ruta real por calles cuando la tenemos; línea recta como respaldo.
  const pathValue = routePolyline
    ? `color:${bc}cc|weight:4|enc:${routePolyline}`
    : `color:${bc}cc|weight:3|${p}|${d}`

  return (
    `https://maps.googleapis.com/maps/api/staticmap?size=${size}&scale=2&maptype=roadmap` +
    markers +
    `&path=${encodeURIComponent(pathValue)}` +
    DARK_STYLE +
    `&key=${mapsKey}`
  )
}

export function tripDirectionsHref(pickup: LatLng, dropoff: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${dropoff.lat},${dropoff.lng}`
}
