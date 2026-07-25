// ── Score compuesto de asignación automática (puro, testeable) ────────────────
// El algoritmo anterior ordenaba SOLO por "menos viajes completados hoy". Era
// justo pero ciego: mandaba al conductor que está a 40 millas antes que al que
// está a 2, ignoraba la calificación del conductor y no aprendía de los
// rechazos. Este módulo convierte esa decisión en cuatro señales ponderadas.
//
// Todo lo que necesita consultar la base vive en auto-assign.ts; aquí solo hay
// aritmética, que es lo que se puede testear de verdad.

/**
 * Pesos por empresa (companies.settings.dispatch_weights). No tienen que sumar
 * 100: el total se normaliza por la suma, así el operador puede subir uno sin
 * tener que recalcular los otros tres.
 */
export interface DispatchWeights {
  proximity: number
  fairness: number
  rating: number
  reliability: number
}

/**
 * Proximidad pesa un poco más que el reparto porque es lo único que el
 * pasajero siente (el conductor llega antes) y lo que le ahorra combustible al
 * operador. El reparto queda cerca para que no se convierta en "el que vive
 * céntrico se queda con todo".
 */
export const DEFAULT_DISPATCH_WEIGHTS: DispatchWeights = {
  proximity: 35,
  fairness: 30,
  rating: 20,
  reliability: 15,
}

/** Más allá de esto la proximidad ya no discrimina: todos están "lejos". */
export const MAX_PROXIMITY_MILES = 25

/**
 * Sin GPS reciente no se puede saber dónde está. Se le da un puntaje medio, no
 * cero: penalizarlo dejaría fuera a las empresas cuyos conductores no usan la
 * app, y premiarlo lo pondría por delante del que sí está cerca.
 */
export const NEUTRAL_PROXIMITY_SCORE = 50

/** Conductor nuevo sin calificaciones — no se le castiga por no tener historial. */
export const NEUTRAL_RATING_SCORE = 70

/** Cada rechazo reciente descuenta esto del puntaje de confiabilidad. */
export const REJECTION_PENALTY = 20

export interface DriverScoreInput {
  driverId: string
  /** Viajes COMPLETADOS hoy — el reparto justo del algoritmo original. */
  tripsToday: number
  /** drivers.rating (1..5) o null si aún no lo han calificado. */
  rating: number | null
  /** Millas en línea recta hasta el punto de recogida, o null sin GPS fresco. */
  distanceMiles: number | null
  /** Rechazos del conductor en los últimos 30 días (booking_events). */
  recentRejections: number
}

export interface DriverScore {
  driverId: string
  total: number
  proximity: number
  fairness: number
  rating: number
  reliability: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Distancia en millas entre dos puntos (fórmula del haversine). Es en línea
 * recta, no por carretera: pedirle a Google la distancia real de cada
 * conductor a cada recogida costaría una llamada por candidato en cada
 * reserva, y para ORDENAR candidatos la línea recta ya distingue bien entre
 * "a 2 millas" y "a 30".
 */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8 // radio terrestre en millas
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Normaliza lo que venga guardado en companies.settings, sin confiar en nada. */
export function parseDispatchWeights(raw: unknown): DispatchWeights {
  const obj = (raw ?? {}) as Record<string, unknown>
  const pick = (key: keyof DispatchWeights): number => {
    const n = Number(obj[key])
    return Number.isFinite(n) && n >= 0 ? clamp(n, 0, 100) : DEFAULT_DISPATCH_WEIGHTS[key]
  }
  const weights: DispatchWeights = {
    proximity: pick('proximity'),
    fairness: pick('fairness'),
    rating: pick('rating'),
    reliability: pick('reliability'),
  }
  // Todo en cero dejaría el score indefinido (división por cero) y todos los
  // conductores empatados: se vuelve a los pesos por defecto.
  const sum = weights.proximity + weights.fairness + weights.rating + weights.reliability
  return sum > 0 ? weights : { ...DEFAULT_DISPATCH_WEIGHTS }
}

/**
 * Puntúa a los candidatos y los devuelve ordenados de mejor a peor.
 *
 * El reparto justo es RELATIVO al grupo y se mide sobre la DIFERENCIA entre el
 * que más viajes lleva hoy y el que menos. Si todos llevan los mismos
 * (incluido cero), todos sacan 100 y la decisión la toman las otras tres
 * señales — que es exactamente lo que se quiere al arrancar el día. Medirlo
 * contra el máximo a secas daría 0 a todos en ese caso: mismo orden, pero un
 * puntaje engañoso en la bitácora.
 */
export function scoreDrivers(
  inputs: readonly DriverScoreInput[],
  weights: DispatchWeights = DEFAULT_DISPATCH_WEIGHTS,
): DriverScore[] {
  const weightSum = weights.proximity + weights.fairness + weights.rating + weights.reliability
  const maxTrips = inputs.reduce((m, i) => Math.max(m, i.tripsToday), 0)
  const minTrips = inputs.reduce((m, i) => Math.min(m, i.tripsToday), Number.POSITIVE_INFINITY)
  const tripSpread = maxTrips - (Number.isFinite(minTrips) ? minTrips : 0)

  const scored = inputs.map((input): DriverScore => {
    const proximity =
      input.distanceMiles == null
        ? NEUTRAL_PROXIMITY_SCORE
        : clamp(100 * (1 - input.distanceMiles / MAX_PROXIMITY_MILES), 0, 100)

    const fairness =
      tripSpread === 0 ? 100 : clamp((100 * (maxTrips - input.tripsToday)) / tripSpread, 0, 100)

    const rating =
      input.rating == null
        ? NEUTRAL_RATING_SCORE
        : clamp(((input.rating - 1) / 4) * 100, 0, 100)

    const reliability = clamp(100 - input.recentRejections * REJECTION_PENALTY, 0, 100)

    const total =
      (proximity * weights.proximity +
        fairness * weights.fairness +
        rating * weights.rating +
        reliability * weights.reliability) /
      weightSum

    return {
      driverId: input.driverId,
      total: round1(total),
      proximity: round1(proximity),
      fairness: round1(fairness),
      rating: round1(rating),
      reliability: round1(reliability),
    }
  })

  // Desempate: menos viajes hoy (el criterio original), y como último recurso
  // el id — para que dos corridas con los mismos datos den el mismo resultado.
  const tripsById = new Map(inputs.map((i) => [i.driverId, i.tripsToday]))
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    const ta = tripsById.get(a.driverId) ?? 0
    const tb = tripsById.get(b.driverId) ?? 0
    if (ta !== tb) return ta - tb
    return a.driverId.localeCompare(b.driverId)
  })

  return scored
}
