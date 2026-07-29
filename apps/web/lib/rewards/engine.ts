// ── Motor de recompensas automáticas (puro, testeable) ───────────────────────
// Los códigos promocionales existían pero eran 100% manuales: el operador
// creaba un código y lo repartía a mano. Esto los vuelve automáticos: cuando
// un cliente cumple una condición, se le genera un código personal.
//
// DECISIÓN DE DISEÑO, no es un olvido: no hay disparador por PUNTUACIÓN de la
// reseña. Dos razones independientes, cada una suficiente:
//
//   1. Google prohíbe expresamente (política de feb-2026) dar descuentos a
//      cambio de reseñas. Combinar "5 estrellas → descuento" con el botón que
//      lleva a Google construye exactamente el embudo sancionado.
//   2. `drivers.rating` alimenta el score de auto-asignación
//      (lib/dispatch/scoring.ts). Si el pasajero aprende que 5 estrellas le da
//      descuento, en un mes todos los conductores tienen 5 estrellas y esa
//      señal deja de distinguir a nadie. Se estaría pagando por destruir el
//      dato que reparte los viajes.
//
// Lo que sí se premia es el ACTO de reseñar (sin mirar la nota) y el
// comportamiento de compra, que es lo que de verdad se quiere reforzar.

export type RewardTrigger =
  | 'trips_completed'
  | 'total_spent'
  | 'first_trip'
  | 'inactivity_days'
  | 'review_submitted'
  | 'birthday'

export interface RewardRule {
  id: string
  name: string
  triggerType: RewardTrigger
  /** N viajes, monto acumulado o días de inactividad. Null si no aplica. */
  threshold: number | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  validDays: number
}

/**
 * Historial del cliente al momento de evaluar. Lo arma el llamador con una
 * consulta; aquí solo se decide.
 */
export interface CustomerStats {
  /** Viajes completados, INCLUYENDO el que acaba de dispararse. */
  tripsCompleted: number
  /** Suma de total_amount de esos viajes. */
  totalSpent: number
  /** Días desde el viaje completado anterior a este. Null si es el primero. */
  daysSincePreviousTrip: number | null
  /** Si el evento que dispara la evaluación fue el envío de una reseña. */
  justSubmittedReview: boolean
  /**
   * Si hoy es el cumpleaños del cliente (mismo mes y día que su fecha de
   * nacimiento). A diferencia de los demás campos, esto no lo calcula un
   * viaje: lo calcula el cron diario de cumpleaños, así que en cualquier
   * otro flujo (completar viaje, dejar reseña) siempre va en `false`.
   */
  isBirthdayToday: boolean
}

/**
 * Normaliza la identidad del cliente. Email en minúsculas si lo hay; si no,
 * el teléfono con solo dígitos.
 *
 * Sin normalizar, "Juan@Mail.com" y "juan@mail.com" serían dos clientes
 * distintos y la misma regla les regalaría dos códigos. El UNIQUE de
 * reward_grants se apoya en esta clave, así que tiene que ser estable.
 */
export function customerKey(
  email: string | null | undefined,
  phone: string | null | undefined,
): string | null {
  const cleanEmail = (email ?? '').trim().toLowerCase()
  if (cleanEmail) return cleanEmail
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 7 ? digits : null
}

/**
 * ¿Esta regla se cumple con estas estadísticas?
 *
 * Los umbrales son ">=" a propósito: si el operador pone "al 5º viaje" y por
 * lo que sea la evaluación no corrió en el viaje 5 (un error transitorio, una
 * regla creada después), el cliente igual la recibe en el 6º en vez de
 * perderla para siempre. Que no se otorgue dos veces lo garantiza el UNIQUE
 * de reward_grants, no este cálculo.
 */
export function ruleMatches(rule: RewardRule, stats: CustomerStats): boolean {
  switch (rule.triggerType) {
    case 'first_trip':
      return stats.tripsCompleted === 1

    case 'review_submitted':
      // Sin mirar la puntuación: se premia haberse tomado la molestia.
      return stats.justSubmittedReview

    case 'birthday':
      // La condición es la fecha, no una cantidad: sin threshold (ver CHECK
      // de la migración 79). Lo calcula el cron, no un viaje.
      return stats.isBirthdayToday

    case 'trips_completed':
      return rule.threshold != null && stats.tripsCompleted >= rule.threshold

    case 'total_spent':
      return rule.threshold != null && stats.totalSpent >= rule.threshold

    case 'inactivity_days':
      // Reconquista: volvió después de estar N días sin viajar. Un cliente
      // nuevo (sin viaje previo) no "volvió" de ninguna parte.
      return (
        rule.threshold != null &&
        stats.daysSincePreviousTrip != null &&
        stats.daysSincePreviousTrip >= rule.threshold
      )

    default:
      return false
  }
}

/**
 * Reglas que disparan, excluyendo las que este cliente ya recibió.
 *
 * Devuelve TODAS las que califican, no solo la primera: si alguien llega a su
 * 10º viaje y a la vez cruza los $1000 de gasto, cumplió las dos cosas y
 * quedarse con una sola sería arbitrario. El operador controla el volumen
 * decidiendo qué reglas crea.
 */
export function evaluateRules(
  rules: readonly RewardRule[],
  stats: CustomerStats,
  alreadyGrantedRuleIds: ReadonlySet<string>,
): RewardRule[] {
  return rules.filter(
    (rule) => !alreadyGrantedRuleIds.has(rule.id) && ruleMatches(rule, stats),
  )
}

/**
 * Código legible generado para una recompensa, ej. "GRACIAS-7K2M".
 *
 * Se evitan I/O/0/1 porque el pasajero puede leer el código de una pantalla y
 * teclearlo en otra, y ahí esos cuatro caracteres se confunden entre sí.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function buildRewardCode(prefix: string, randomBytes: Uint8Array): string {
  const clean = prefix
    .toUpperCase()
    // NFD separa cada letra de su acento, y el filtro A-Z0-9 de la línea
    // siguiente se lleva el acento suelto. Así "PREMIÓ" queda "PREMIO" y no
    // "PREMI", sin necesidad de un rango de marcas combinantes aparte.
    .normalize('NFD')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'PREMIO'

  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[randomBytes[i]! % CODE_ALPHABET.length]
  }
  return `${clean}-${suffix}`
}

/** Fecha de vencimiento del código, a partir de la vigencia de la regla. */
export function expiresAt(rule: RewardRule, now: Date): string {
  return new Date(now.getTime() + rule.validDays * 86_400_000).toISOString()
}

/**
 * Periodo al que pertenece un otorgamiento, para el UNIQUE
 * (rule_id, customer_key, period_key) de la migración 79.
 *
 * Todo lo que no es cumpleaños sigue siendo 'once': una vez en la vida del
 * cliente, el comportamiento de siempre. El cumpleaños usa el año en curso
 * como periodo para que la misma regla pueda volver a otorgarse cada 12
 * meses sin chocar con el otorgamiento del año anterior.
 */
export function periodKeyFor(rule: RewardRule, now: Date): string {
  return rule.triggerType === 'birthday' ? String(now.getUTCFullYear()) : 'once'
}

/**
 * ¿Hoy es el cumpleaños de este cliente? Compara mes y día, nunca el año
 * (si no, nadie cumpliría años dos veces). `dateOfBirth` es la fecha tal
 * cual sale de user_profiles.date_of_birth (columna DATE, formato
 * YYYY-MM-DD).
 */
export function isBirthdayMatch(dateOfBirth: string | null | undefined, now: Date): boolean {
  if (!dateOfBirth) return false
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return false
  return dob.getUTCMonth() === now.getUTCMonth() && dob.getUTCDate() === now.getUTCDate()
}
