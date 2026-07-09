// ── Sección G — LuxeRide Affiliate Network: lógica central ────────────────────
// Funciones puras, testeables sin DB (mismo patrón que lib/compliance/engine.ts
// y lib/policy/engine.ts). Ver docs/PENDING.md sección G para el diseño.

export type AffiliateTripStatus =
  | 'requested' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'cancelled'
  | 'en_route' | 'arrived' | 'in_progress' | 'completed'

export type AffiliateReason = 'no_driver' | 'out_of_zone' | 'overcapacity' | 'better_affiliate_rate' | 'other'

export type BrandingMode = 'white_label' | 'operated_by' | 'co_branded'

export type SettlementStatus = 'pending' | 'invoiced' | 'paid' | 'disputed'

// Estados en los que la solicitud sigue "viva" (no cerrada) del lado de la
// respuesta inicial del afiliado — antes de que empiece a operar el viaje.
export const PENDING_RESPONSE_STATUSES: AffiliateTripStatus[] = ['requested', 'countered']

// Estados en los que el afiliado ya está operando el viaje (aceptado).
export const OPERATING_STATUSES: AffiliateTripStatus[] = ['accepted', 'en_route', 'arrived', 'in_progress']

// Estados terminales — el registro ya no cambia más.
export const CLOSED_STATUSES: AffiliateTripStatus[] = ['rejected', 'expired', 'cancelled', 'completed']

export function isPendingResponse(status: AffiliateTripStatus): boolean {
  return PENDING_RESPONSE_STATUSES.includes(status)
}

export function isOperating(status: AffiliateTripStatus): boolean {
  return OPERATING_STATUSES.includes(status)
}

export function isClosed(status: AffiliateTripStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

/**
 * Tiempo límite de respuesta para el afiliado, según qué tan pronto es el
 * viaje (ver docs/PENDING.md sección G, paso 3):
 *   - Viaje HOY (dentro de las próximas 24h)              → 10 minutos
 *   - Viaje MAÑANA (entre 24h y 48h)                       → 30 minutos
 *   - Viaje a futuro (más de 48h)                          → 2 horas
 */
export function computeResponseDeadline(scheduledAt: Date, now: Date = new Date()): Date {
  const hoursUntilTrip = (scheduledAt.getTime() - now.getTime()) / 3_600_000
  let windowMinutes: number
  if (hoursUntilTrip <= 24) windowMinutes = 10
  else if (hoursUntilTrip <= 48) windowMinutes = 30
  else windowMinutes = 120
  return new Date(now.getTime() + windowMinutes * 60_000)
}

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return now.getTime() > expiry.getTime()
}

/**
 * Margen para la empresa principal: lo que le cobró al pasajero, menos lo
 * que le paga al afiliado, menos el fee de plataforma (si aplica). Puede dar
 * negativo si el dispatcher ofrece un precio al afiliado mayor al cobrado
 * (la UI debe advertir, pero no se bloquea — es una decisión operativa
 * válida, ej. proteger la relación con un cliente corporativo).
 */
export function computeMargin(opts: {
  passengerChargedAmount: number
  agreedPrice: number
  platformFeeAmount?: number
}): number {
  const fee = opts.platformFeeAmount ?? 0
  return Math.round((opts.passengerChargedAmount - opts.agreedPrice - fee) * 100) / 100
}

/** ¿Puede el afiliado todavía aceptar/rechazar/contraofertar? */
export function canAffiliateRespond(status: AffiliateTripStatus, expiresAt: string, now: Date = new Date()): boolean {
  return isPendingResponse(status) && !isExpired(expiresAt, now)
}

/** ¿Puede el owner cancelar la solicitud (antes de que el afiliado la opere)? */
export function canOwnerCancel(status: AffiliateTripStatus): boolean {
  return isPendingResponse(status) || status === 'accepted'
}

const OPERATIONAL_STEP_ORDER: AffiliateTripStatus[] = ['accepted', 'en_route', 'arrived', 'in_progress', 'completed']

/** Próximo estado operativo válido (para el botón "Siguiente paso" del afiliado). */
export function nextOperationalStatus(current: AffiliateTripStatus): AffiliateTripStatus | null {
  const idx = OPERATIONAL_STEP_ORDER.indexOf(current)
  if (idx === -1 || idx === OPERATIONAL_STEP_ORDER.length - 1) return null
  return OPERATIONAL_STEP_ORDER[idx + 1] ?? null
}

/** Texto de marca frente al pasajero según el modo elegido por la empresa principal. */
export function resolveBrandingLabel(
  mode: BrandingMode,
  ownerName: string,
  affiliateName: string,
): { operatedByLine: string | null } {
  if (mode === 'white_label') return { operatedByLine: null }
  if (mode === 'operated_by') return { operatedByLine: affiliateName }
  return { operatedByLine: `${ownerName} · ${affiliateName}` } // co_branded
}
