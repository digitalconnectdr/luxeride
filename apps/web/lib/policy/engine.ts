// ── F1.10 — Policy Engine ──────────────────────────────────────────────────────
// Funciones puras, server-side. Las políticas viven en companies.settings (JSONB):
//
//   settings.policy = {
//     free_cancellation_hours:   24,   // horas antes del viaje con cancelación gratis
//     late_cancellation_fee_pct: 50,   // % del total si cancela dentro de la ventana
//     no_show_fee_pct:           100,  // % del total si el pasajero no aparece
//     modification_min_hours:    4,    // horas mínimas antes del viaje para modificar
//   }
//
//   settings.booking = {
//     advance_booking_hours: 2,        // mínimo de anticipación para reservar
//     max_advance_days:      90,       // máximo de días hacia el futuro
//   }

export interface PolicySettings {
  free_cancellation_hours: number
  late_cancellation_fee_pct: number
  no_show_fee_pct: number
  modification_min_hours: number
}

export interface BookingWindowSettings {
  advance_booking_hours: number
  max_advance_days: number
}

export const DEFAULT_POLICY: PolicySettings = {
  free_cancellation_hours: 24,
  late_cancellation_fee_pct: 50,
  no_show_fee_pct: 100,
  modification_min_hours: 4,
}

export const DEFAULT_BOOKING_WINDOW: BookingWindowSettings = {
  advance_booking_hours: 2,
  max_advance_days: 90,
}

function clampPct(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

function clampHours(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || Number.isNaN(n) || n < 0) return fallback
  return n
}

/** Extrae la política de cancelación del JSONB de settings, con defaults seguros. */
export function parsePolicy(settings: unknown): PolicySettings {
  const raw = (settings as { policy?: Partial<PolicySettings> } | null)?.policy ?? {}
  return {
    free_cancellation_hours:   clampHours(raw.free_cancellation_hours, DEFAULT_POLICY.free_cancellation_hours),
    late_cancellation_fee_pct: clampPct(raw.late_cancellation_fee_pct, DEFAULT_POLICY.late_cancellation_fee_pct),
    no_show_fee_pct:           clampPct(raw.no_show_fee_pct, DEFAULT_POLICY.no_show_fee_pct),
    modification_min_hours:    clampHours(raw.modification_min_hours, DEFAULT_POLICY.modification_min_hours),
  }
}

// ─── Cargos extra en viaje (pasajero/equipaje adicional) ─────────────────────
//
//   settings.fees = {
//     extra_passenger_fee: 15,  // monto por pasajero por encima de la capacidad (0 = desactivado)
//     extra_luggage_fee:   10,  // monto por pieza de equipaje extra (0 = desactivado)
//   }

export interface ExtraFeesSettings {
  extra_passenger_fee: number
  extra_luggage_fee: number
}

export const DEFAULT_EXTRA_FEES: ExtraFeesSettings = {
  extra_passenger_fee: 0,
  extra_luggage_fee: 0,
}

/** Extrae los cargos extra del JSONB de settings, con defaults seguros (0 = desactivado). */
export function parseExtraFees(settings: unknown): ExtraFeesSettings {
  const raw = (settings as { fees?: Partial<ExtraFeesSettings> } | null)?.fees ?? {}
  const clampAmount = (n: unknown) =>
    typeof n === 'number' && !Number.isNaN(n) && n > 0 ? Math.min(9999, Math.round(n * 100) / 100) : 0
  return {
    extra_passenger_fee: clampAmount(raw.extra_passenger_fee),
    extra_luggage_fee:   clampAmount(raw.extra_luggage_fee),
  }
}

/** Extrae la ventana de reservación del JSONB de settings, con defaults seguros. */
export function parseBookingWindow(settings: unknown): BookingWindowSettings {
  const raw = (settings as { booking?: Partial<BookingWindowSettings> } | null)?.booking ?? {}
  return {
    advance_booking_hours: clampHours(raw.advance_booking_hours, DEFAULT_BOOKING_WINDOW.advance_booking_hours),
    max_advance_days:      clampHours(raw.max_advance_days, DEFAULT_BOOKING_WINDOW.max_advance_days),
  }
}

// ─── Cancelación ──────────────────────────────────────────────────────────────

export type CancellationKind = 'free' | 'late' | 'no_show'

export interface CancellationFee {
  kind: CancellationKind
  feePct: number
  feeAmount: number
}

/**
 * Calcula el fee de cancelación según la política de la empresa.
 * - Cancelación fuera de la ventana (>= free_cancellation_hours antes) → gratis
 * - Cancelación dentro de la ventana → late_cancellation_fee_pct del total
 * - No-show → no_show_fee_pct del total
 */
export function computeCancellationFee(
  policy: PolicySettings,
  scheduledAt: Date,
  totalAmount: number,
  opts?: { noShow?: boolean; now?: Date },
): CancellationFee {
  const now = opts?.now ?? new Date()
  const total = Math.max(0, totalAmount)

  if (opts?.noShow) {
    const pct = policy.no_show_fee_pct
    return { kind: 'no_show', feePct: pct, feeAmount: round2(total * (pct / 100)) }
  }

  const hoursUntilTrip = (scheduledAt.getTime() - now.getTime()) / 3_600_000

  if (hoursUntilTrip >= policy.free_cancellation_hours) {
    return { kind: 'free', feePct: 0, feeAmount: 0 }
  }

  const pct = policy.late_cancellation_fee_pct
  return { kind: 'late', feePct: pct, feeAmount: round2(total * (pct / 100)) }
}

// ─── Ventana de reservación ───────────────────────────────────────────────────

export interface BookingTimeValidation {
  valid: boolean
  error?: string
}

/** Valida que la fecha del viaje cumpla la ventana de reservación de la empresa. */
export function validateBookingTime(
  window: BookingWindowSettings,
  scheduledAt: Date,
  now: Date = new Date(),
): BookingTimeValidation {
  if (Number.isNaN(scheduledAt.getTime())) {
    return { valid: false, error: 'Fecha inválida' }
  }

  const hoursAhead = (scheduledAt.getTime() - now.getTime()) / 3_600_000

  if (hoursAhead < window.advance_booking_hours) {
    return {
      valid: false,
      error: `Las reservaciones requieren al menos ${window.advance_booking_hours} hora(s) de anticipación`,
    }
  }

  if (hoursAhead > window.max_advance_days * 24) {
    return {
      valid: false,
      error: `Las reservaciones solo pueden hacerse hasta ${window.max_advance_days} días por adelantado`,
    }
  }

  return { valid: true }
}

// ─── Modificación ─────────────────────────────────────────────────────────────

/** ¿La reservación aún puede modificarse según la política? */
export function canModifyBooking(
  policy: PolicySettings,
  scheduledAt: Date,
  now: Date = new Date(),
): boolean {
  const hoursUntilTrip = (scheduledAt.getTime() - now.getTime()) / 3_600_000
  return hoursUntilTrip >= policy.modification_min_hours
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
