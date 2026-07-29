// ── Protocolo de respaldo (Guaranteed Ride) ────────────────────────────────────
// Detecta si un conductor YA asignado a una reserva corre riesgo real de no
// llegar a tiempo, para poder reasignar DENTRO de la misma flota antes de que
// el pasajero se entere de que algo salió mal. Puro y testeable — todo lo que
// toca la base (bookings, driver_presence) vive en la ruta del cron
// (app/api/cron/dispatch-risk-check) y en auto-assign.ts.

import { haversineMiles } from '@/lib/dispatch/scoring'

// Fuera de esta ventana antes del pickup, no hay urgencia: un conductor sin
// GPS reciente a las 3 horas del pickup no es una emergencia, es un martes
// cualquiera.
export const RISK_WINDOW_MINUTES = 45

// Sin ninguna posición reportada en este lapso, ya no se sabe dónde está el
// conductor — no se puede confiar en que va a llegar.
export const STALE_POSITION_MINUTES = 20

// Velocidad conservadora (millas/hora) usada solo para estimar si ALCANZA a
// llegar a tiempo en línea recta — no es una ruta real, es un piso: si ni a
// esta velocidad optimista llega, definitivamente está en riesgo.
const CONSERVATIVE_SPEED_MPH = 25

export interface DriverRiskInput {
  scheduledAt: Date
  pickup: { lat: number; lng: number }
  lastPosition: { lat: number; lng: number } | null
  lastPositionAt: Date | null
  now: Date
}

/**
 * true si el conductor asignado corre riesgo de no llegar a tiempo al pickup.
 *
 * Riesgo = el pickup está dentro de la ventana próxima (RISK_WINDOW_MINUTES) Y
 * (no hay posición reciente, O la posición que hay implica que no alcanza a
 * llegar ni a velocidad optimista).
 */
export function isDriverAtRisk(input: DriverRiskInput): boolean {
  const minutesToPickup = (input.scheduledAt.getTime() - input.now.getTime()) / 60_000
  if (minutesToPickup > RISK_WINDOW_MINUTES || minutesToPickup < 0) return false

  if (!input.lastPosition || !input.lastPositionAt) return true

  const minutesSincePosition = (input.now.getTime() - input.lastPositionAt.getTime()) / 60_000
  if (minutesSincePosition > STALE_POSITION_MINUTES) return true

  const miles = haversineMiles(input.lastPosition, input.pickup)
  const hoursNeeded = miles / CONSERVATIVE_SPEED_MPH
  const minutesNeeded = hoursNeeded * 60
  return minutesNeeded > minutesToPickup
}
