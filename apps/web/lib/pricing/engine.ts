// ── Pricing Engine (puro, testeable) ──────────────────────────────────────────
// Extraído de app/actions/bookings.ts para poder testearlo con Vitest y para
// que los recargos usen la HORA LOCAL de la empresa (no UTC).

import type { BookingType } from '@/lib/supabase/database.types'

export interface PricingRuleFields {
  id: string
  vehicle_type_id: string | null
  model: string
  base_price: number
  per_mile_rate: number | null
  per_km_rate: number | null
  hourly_rate: number | null
  minimum_fare: number | null
  minimum_hours: number | null
  origin_zone_id: string | null
  destination_zone_id: string | null
  airport_pickup_fee: number | null
  airport_dropoff_fee: number | null
  night_surcharge_pct: number | null
  weekend_surcharge_pct: number | null
  holiday_surcharge_pct: number | null
  surge_enabled: boolean | null
  surge_multiplier: number | null
  /** Vigencia (columnas que existen desde el inicio y nunca se usaron). */
  valid_from?: string | null
  valid_until?: string | null
  /** Días en que la regla aplica: 0=domingo … 6=sábado. NULL = todos. */
  days_of_week?: number[] | null
}

export interface ZonePair {
  originZoneId: string | null
  destinationZoneId: string | null
}

export interface FareResult {
  baseAmount: number
  surchargeAmount: number
  totalAmount: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Hora, día de la semana y fecha (YYYY-MM-DD) LOCALES de la empresa.
 * Si el timezone es inválido, cae a UTC (comportamiento anterior).
 *
 * La fecha sale de la MISMA llamada a Intl que la hora: un viaje a las 23:00
 * del 31 de diciembre en Santo Domingo ya es 1 de enero en UTC, así que
 * calcular la fecha por separado con getUTCDate() daría el feriado equivocado.
 */
export function getLocalTimeParts(
  date: Date,
  timeZone: string | null | undefined,
): { hour: number; day: number; isoDate: string } {
  if (timeZone) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hourCycle: 'h23',
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const parts = fmt.formatToParts(date)
      const hourStr = parts.find((p) => p.type === 'hour')?.value
      const weekday = parts.find((p) => p.type === 'weekday')?.value
      const year = parts.find((p) => p.type === 'year')?.value
      const month = parts.find((p) => p.type === 'month')?.value
      const dayNum = parts.find((p) => p.type === 'day')?.value
      const DAY_INDEX: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
      }
      const hour = hourStr != null ? parseInt(hourStr, 10) : NaN
      const day = weekday != null ? DAY_INDEX[weekday] : undefined
      if (!Number.isNaN(hour) && day !== undefined && year && month && dayNum) {
        return { hour, day, isoDate: `${year}-${month}-${dayNum}` }
      }
    } catch {
      // timezone inválido — fallback a UTC
    }
  }
  return {
    hour: date.getUTCHours(),
    day: date.getUTCDay(),
    isoDate: date.toISOString().slice(0, 10),
  }
}

/**
 * Calcula la tarifa según el modelo de la regla + recargos.
 * Los recargos nocturno (22:00–06:00) y de fin de semana se evalúan en la
 * hora local de la empresa (`timezone`).
 */
export function calculateFare(
  rule: PricingRuleFields,
  distanceMiles: number,
  durationMinutes: number,
  scheduledAt: Date,
  bookingType: BookingType,
  timezone?: string | null,
  requestedHours?: number | null,
  /**
   * Fechas de feriado de la empresa en formato 'YYYY-MM-DD' (ver
   * company_holidays, migración 77). Sin esto `holiday_surcharge_pct` no se
   * puede aplicar — que es exactamente por qué fue código muerto hasta ahora.
   */
  holidayDates?: readonly string[] | null,
): FareResult {
  let base = 0

  switch (rule.model) {
    case 'flat_rate':
      base = rule.base_price
      break
    case 'per_mile':
      base = rule.base_price + (rule.per_mile_rate ?? 0) * distanceMiles
      break
    case 'per_km': {
      const km = distanceMiles * 1.60934
      base = rule.base_price + (rule.per_km_rate ?? 0) * km
      break
    }
    case 'hourly': {
      // Si el cliente/staff indicó cuántas horas quiere (servicio "a
      // disposición": bodas, eventos, con paradas y esperas), se usa eso en
      // vez de la duración estimada de Google Maps entre origen y destino
      // — que no representa el bloque de horas real contratado. minimum_hours
      // sigue siendo el piso en ambos casos (regla del operador, ej. "3h
      // mínimo"), incluso si el cliente pidió menos.
      const baseHours = requestedHours != null && requestedHours > 0
        ? requestedHours
        : durationMinutes / 60
      const hours = Math.max(baseHours, rule.minimum_hours ?? 0)
      base = (rule.hourly_rate ?? 0) * hours
      break
    }
    case 'zone_based':
    default:
      base = rule.base_price
  }

  // Mínimo
  if (rule.minimum_fare && base < rule.minimum_fare) base = rule.minimum_fare

  // Recargos — hora local de la empresa
  let surcharge = 0
  const { hour, day, isoDate } = getLocalTimeParts(scheduledAt, timezone)

  if ((hour >= 22 || hour < 6) && rule.night_surcharge_pct) {
    surcharge += base * (rule.night_surcharge_pct / 100)
  }
  if ((day === 0 || day === 6) && rule.weekend_surcharge_pct) {
    surcharge += base * (rule.weekend_surcharge_pct / 100)
  }
  // Feriado: se acumula con el de fin de semana si el feriado cae sábado o
  // domingo — son dos razones distintas para cobrar más (día no laborable Y
  // fecha especial), y el operador que configuró ambos porcentajes espera
  // que ambos cuenten.
  if (holidayDates?.length && rule.holiday_surcharge_pct && holidayDates.includes(isoDate)) {
    surcharge += base * (rule.holiday_surcharge_pct / 100)
  }
  if (bookingType === 'airport_pickup' && rule.airport_pickup_fee) {
    surcharge += rule.airport_pickup_fee
  }
  if (bookingType === 'airport_dropoff' && rule.airport_dropoff_fee) {
    surcharge += rule.airport_dropoff_fee
  }
  if (rule.surge_enabled && (rule.surge_multiplier ?? 1) > 1) {
    surcharge += base * ((rule.surge_multiplier ?? 1) - 1)
  }

  return {
    baseAmount: round2(base),
    surchargeAmount: round2(surcharge),
    totalAmount: round2(base + surcharge),
  }
}

/**
 * Momento del viaje ya resuelto en la zona horaria de la empresa. Se pasa a
 * bestRule para poder descartar reglas fuera de vigencia sin que la función
 * tenga que saber nada de timezones.
 */
export interface RuleWhen {
  /** 'YYYY-MM-DD' local de la empresa. */
  isoDate: string
  /** 0=domingo … 6=sábado, local de la empresa. */
  day: number
}

/**
 * ¿Esta regla aplica para la fecha del viaje?
 *
 * `valid_from`, `valid_until` y `days_of_week` existen en la tabla desde el
 * inicio pero nunca se consultaban: una regla "Temporada alta 15 dic – 15 ene"
 * se guardaba bien y se aplicaba todo el año. Sin fecha del viaje (llamadas
 * viejas que no pasan `when`) se mantiene el comportamiento anterior: todo
 * aplica.
 */
export function isRuleApplicable(rule: PricingRuleFields, when?: RuleWhen): boolean {
  if (!when) return true
  if (rule.valid_from && when.isoDate < rule.valid_from) return false
  if (rule.valid_until && when.isoDate > rule.valid_until) return false
  // Un arreglo vacío se trata como "sin restricción", no como "ningún día":
  // guardar [] por accidente no debe dejar a la empresa sin precio.
  if (rule.days_of_week?.length && !rule.days_of_week.includes(when.day)) return false
  return true
}

/**
 * Mejor regla para un tipo de vehículo (+ opcionalmente un par de zona
 * origen/destino). Prioridad:
 *   1. Regla "Por zona" que coincida EXACTO con el par de zonas Y el tipo
 *      de vehículo específico (ej. "Aeropuerto → 51000 en SUV").
 *   2. Regla "Por zona" que coincida con el par de zonas para CUALQUIER
 *      tipo de vehículo (vehicle_type_id NULL).
 *   3. Si no hay match de zona (o no se pasó zonePair): regla NO-zona
 *      específica del tipo de vehículo, luego la general. Las reglas
 *      "Por zona" quedan EXCLUIDAS de este paso — sin un par de zona que
 *      coincida, una regla zone_based no tiene un precio que tenga sentido
 *      usar como respaldo genérico.
 * Las reglas vienen ordenadas por priority DESC.
 */
export function bestRule(
  allRules: PricingRuleFields[],
  vehicleTypeId: string | null,
  zonePair?: ZonePair,
  when?: RuleWhen,
): PricingRuleFields | undefined {
  // La vigencia se filtra ANTES de cualquier prioridad: una regla vencida no
  // es la "mejor regla", no existe para este viaje.
  const rules = when ? allRules.filter((r) => isRuleApplicable(r, when)) : allRules

  if (zonePair?.originZoneId && zonePair?.destinationZoneId) {
    const zoneMatch =
      rules.find(
        (r) =>
          r.model === 'zone_based' &&
          r.origin_zone_id === zonePair.originZoneId &&
          r.destination_zone_id === zonePair.destinationZoneId &&
          vehicleTypeId &&
          r.vehicle_type_id === vehicleTypeId,
      ) ??
      rules.find(
        (r) =>
          r.model === 'zone_based' &&
          r.origin_zone_id === zonePair.originZoneId &&
          r.destination_zone_id === zonePair.destinationZoneId &&
          r.vehicle_type_id === null,
      )
    if (zoneMatch) return zoneMatch
  }

  const nonZoneRules = rules.filter((r) => r.model !== 'zone_based')
  return (
    nonZoneRules.find((r) => vehicleTypeId && r.vehicle_type_id === vehicleTypeId) ??
    nonZoneRules.find((r) => r.vehicle_type_id === null)
  )
}
