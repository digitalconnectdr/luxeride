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

// ─── Horario de operación / fechas bloqueadas (Sección H, item 3) ────────────
//
//   settings.booking también acepta:
//     operating_hours_start: '08:00'  // HH:mm, hora local de la empresa
//     operating_hours_end:   '22:00'  // null/null = sin restricción de horario
//     blackout_dates: ['2026-12-25', '2026-01-01']  // YYYY-MM-DD, hora local

export interface OperatingHoursSettings {
  start: string | null
  end: string | null
  blackoutDates: string[]
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Extrae horario de operación y fechas bloqueadas del JSONB de settings. */
export function parseOperatingHours(settings: unknown): OperatingHoursSettings {
  const b = (settings as {
    booking?: { operating_hours_start?: string; operating_hours_end?: string; blackout_dates?: string[] }
  } | null)?.booking ?? {}
  const start = typeof b.operating_hours_start === 'string' && TIME_RE.test(b.operating_hours_start) ? b.operating_hours_start : null
  const end   = typeof b.operating_hours_end === 'string' && TIME_RE.test(b.operating_hours_end) ? b.operating_hours_end : null
  const blackoutDates = Array.isArray(b.blackout_dates)
    ? b.blackout_dates.filter((d): d is string => typeof d === 'string' && DATE_RE.test(d))
    : []
  return { start, end, blackoutDates }
}

/** Fecha (YYYY-MM-DD) y minutos-del-día en la hora LOCAL de la empresa. */
function localDateTimeParts(date: Date, timeZone: string | null | undefined): { dateStr: string; minutesOfDay: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
    const parts = fmt.formatToParts(date)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
    return {
      dateStr: `${get('year')}-${get('month')}-${get('day')}`,
      minutesOfDay: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
    }
  } catch {
    return { dateStr: date.toISOString().slice(0, 10), minutesOfDay: date.getUTCHours() * 60 + date.getUTCMinutes() }
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Valida horario de operación + fechas bloqueadas de la empresa (hora local). */
export function validateOperatingHours(
  hours: OperatingHoursSettings,
  scheduledAt: Date,
  timezone: string | null | undefined,
): BookingTimeValidation {
  const { dateStr, minutesOfDay } = localDateTimeParts(scheduledAt, timezone)

  if (hours.blackoutDates.includes(dateStr)) {
    return { valid: false, error: 'Esa fecha no está disponible para reservar.' }
  }

  if (hours.start && hours.end) {
    const startM = toMinutes(hours.start)
    const endM = toMinutes(hours.end)
    const withinWindow = startM <= endM
      ? minutesOfDay >= startM && minutesOfDay <= endM
      : minutesOfDay >= startM || minutesOfDay <= endM // ventana que cruza medianoche
    if (!withinWindow) {
      return { valid: false, error: `Solo aceptamos reservas entre ${hours.start} y ${hours.end}.` }
    }
  }

  return { valid: true }
}
