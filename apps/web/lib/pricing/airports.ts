// ── Cargo automático por recogida/entrega en aeropuerto (puro, testeable) ──────
// La pestaña /admin/aeropuertos deja configurar un cargo de recogida y uno de
// entrega POR AEROPUERTO ESPECÍFICO (company_airports.pickup_fee/dropoff_fee) —
// pero hasta ahora esos montos nunca se leían en ningún lado fuera de esa
// misma pestaña: un operador podía configurar $25 de recogida en JFK y esa
// reserva jamás cobraba el cargo. Esto detecta automáticamente, por cercanía
// geográfica (el punto de pickup/dropoff cae dentro de un radio corto de la
// lat/lng del aeropuerto), a qué aeropuerto configurado corresponde un viaje,
// sin requerir que el pasajero declare nada — mismo criterio de "línea recta,
// no por carretera" que ya usa lib/dispatch/scoring.ts para candidatos.

import { haversineMiles } from '@/lib/dispatch/scoring'

// Un pickup/dropoff dentro de esta distancia del aeropuerto cuenta como "en
// el aeropuerto" — suficiente para cubrir las distintas terminales de un
// aeropuerto real sin capturar direcciones cercanas que no son el aeropuerto.
export const AIRPORT_MATCH_RADIUS_MILES = 1

export interface CompanyAirportForMatch {
  airportId: string
  lat: number
  lng: number
  pickupFee: number
  dropoffFee: number
}

export interface PointForAirportMatch {
  lat: number
  lng: number
}

export interface AirportFeeResult {
  pickupFee: number
  dropoffFee: number
  pickupAirportId: string | null
  dropoffAirportId: string | null
}

/** El aeropuerto configurado más cercano al punto, dentro del radio — o null si ninguno cae cerca. */
function nearestAirport(
  airports: CompanyAirportForMatch[],
  point: PointForAirportMatch,
): CompanyAirportForMatch | null {
  let best: { airport: CompanyAirportForMatch; distance: number } | null = null
  for (const a of airports) {
    const distance = haversineMiles(point, { lat: a.lat, lng: a.lng })
    if (distance > AIRPORT_MATCH_RADIUS_MILES) continue
    if (!best || distance < best.distance) best = { airport: a, distance }
  }
  return best?.airport ?? null
}

/**
 * Cargo total por aeropuerto de un viaje — hasta dos cargos independientes
 * (pickup y dropoff pueden ser aeropuertos distintos, ej. un viaje entre dos
 * aeropuertos, o ninguno de los dos serlo).
 */
export function resolveAirportFees(
  airports: CompanyAirportForMatch[],
  pickup: PointForAirportMatch,
  dropoff: PointForAirportMatch,
): AirportFeeResult {
  const pickupAirport = nearestAirport(airports, pickup)
  const dropoffAirport = nearestAirport(airports, dropoff)
  return {
    pickupFee: pickupAirport?.pickupFee ?? 0,
    dropoffFee: dropoffAirport?.dropoffFee ?? 0,
    pickupAirportId: pickupAirport?.airportId ?? null,
    dropoffAirportId: dropoffAirport?.airportId ?? null,
  }
}
