// ── Otorgamiento de recompensas ───────────────────────────────────────────────
// Junta las piezas: arma las estadísticas del cliente, pregunta al motor puro
// qué reglas disparan, y por cada una crea un código promocional personal.
//
// Nunca lanza. Se invoca desde el flujo de completar viaje y de dejar reseña,
// y una recompensa que falla jamás debe tumbar ninguno de esos dos flujos: el
// viaje ya ocurrió y la reseña ya se guardó.

import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyPassengerInBackground } from '@/lib/notifications/passenger-feed'
import {
  customerKey,
  evaluateRules,
  buildRewardCode,
  expiresAt,
  periodKeyFor,
  isBirthdayMatch,
  type RewardRule,
  type RewardTrigger,
  type CustomerStats,
} from './engine'

interface GrantContext {
  companyId: string
  /** Null para el cumpleaños: no hay viaje que lo dispare. */
  bookingId: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerId: string | null
  /** true si el disparo viene de haber enviado una reseña. */
  justSubmittedReview: boolean
}

export interface GrantedReward {
  ruleName: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
}

/**
 * Evalúa las reglas de la empresa para este cliente y otorga lo que aplique.
 * Devuelve lo otorgado (vacío si nada aplicó, que es el caso normal).
 */
export async function grantRewardsForBooking(ctx: GrantContext): Promise<GrantedReward[]> {
  try {
    const key = customerKey(ctx.customerEmail, ctx.customerPhone)
    // Sin email ni teléfono no hay a quién premiar ni forma de evitar que la
    // misma persona lo reciba dos veces. Se sale en silencio.
    if (!key) return []

    const admin = createAdminClient()
    const rules = await loadActiveRules(admin, ctx.companyId)
    if (!rules.length) return []

    const stats = await buildCustomerStats(admin, ctx, key)
    const granted = await evaluateAndGrant(admin, ctx, rules, stats, key)

    if (granted.length && ctx.customerId) {
      notifyRewards(ctx, granted)
    }

    return granted
  } catch (err) {
    console.error('[grantRewardsForBooking]', err)
    return []
  }
}

/**
 * Cron diario de cumpleaños. A diferencia de grantRewardsForBooking, aquí no
 * hay un viaje que dispare la evaluación: la dispara el calendario. Por eso
 * recorre los perfiles de cliente de la empresa buscando a quién le toca hoy,
 * en vez de partir de una reserva puntual.
 */
export async function grantBirthdayRewards(companyId: string): Promise<{ granted: number }> {
  try {
    const admin = createAdminClient()
    const rules = await loadActiveRules(admin, companyId, 'birthday')
    // Sin reglas de cumpleaños activas no vale la pena ni recorrer perfiles.
    if (!rules.length) return { granted: 0 }

    const now = new Date()
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, phone, date_of_birth')
      .eq('company_id', companyId)
      .eq('role', 'customer')
      .not('date_of_birth', 'is', null)

    const todaysBirthdays = (profiles ?? []).filter((p) => isBirthdayMatch(p.date_of_birth, now))
    if (!todaysBirthdays.length) return { granted: 0 }

    const stats: CustomerStats = {
      tripsCompleted: 0,
      totalSpent: 0,
      daysSincePreviousTrip: null,
      justSubmittedReview: false,
      isBirthdayToday: true,
    }

    let granted = 0
    for (const profile of todaysBirthdays) {
      // El email vive en auth.users, no en user_profiles (mismo patrón que
      // getSuperAdminEmails en lib/notifications/index.ts).
      let email: string | null = null
      try {
        const { data } = await admin.auth.admin.getUserById(profile.id)
        email = data.user?.email ?? null
      } catch {
        /* usuario sin acceso a auth — se sigue con el teléfono si lo hay */
      }

      const key = customerKey(email, profile.phone)
      if (!key) continue

      const ctx: GrantContext = {
        companyId,
        bookingId: null,
        customerEmail: email,
        customerPhone: profile.phone,
        customerId: profile.id,
        justSubmittedReview: false,
      }

      const result = await evaluateAndGrant(admin, ctx, rules, stats, key)
      if (result.length) {
        granted += result.length
        notifyRewards(ctx, result)
      }
    }

    return { granted }
  } catch (err) {
    console.error('[grantBirthdayRewards]', err)
    return { granted: 0 }
  }
}

/** Reglas activas de la empresa, opcionalmente filtradas a un solo disparador. */
async function loadActiveRules(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  triggerType?: RewardTrigger,
): Promise<RewardRule[]> {
  let query = admin
    .from('reward_rules')
    .select('id, name, trigger_type, threshold, discount_type, discount_value, valid_days')
    .eq('company_id', companyId)
    .eq('is_active', true)
  if (triggerType) query = query.eq('trigger_type', triggerType)

  const { data } = await query
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    triggerType: r.trigger_type,
    threshold: r.threshold == null ? null : Number(r.threshold),
    discountType: r.discount_type,
    discountValue: Number(r.discount_value),
    validDays: r.valid_days,
  }))
}

/**
 * Pregunta al motor puro qué reglas disparan y otorga cada una.
 *
 * El "ya otorgado" es por periodo, no solo por rule_id: un grant cuenta como
 * bloqueante SOLO si su period_key coincide con el que le tocaría a esa regla
 * AHORA (periodKeyFor). Para reglas normales eso es 'once' siempre, así que
 * el comportamiento no cambia. Para cumpleaños es el año en curso, así que un
 * grant del año pasado no bloquea el de este año.
 */
async function evaluateAndGrant(
  admin: ReturnType<typeof createAdminClient>,
  ctx: GrantContext,
  rules: RewardRule[],
  stats: CustomerStats,
  key: string,
): Promise<GrantedReward[]> {
  const now = new Date()

  const { data: grantsRaw } = await admin
    .from('reward_grants')
    .select('rule_id, period_key')
    .eq('company_id', ctx.companyId)
    .eq('customer_key', key)

  const periodByRule = new Map(rules.map((r) => [r.id, periodKeyFor(r, now)]))
  const already = new Set(
    (grantsRaw ?? [])
      .filter((g) => g.period_key === (periodByRule.get(g.rule_id) ?? 'once'))
      .map((g) => g.rule_id),
  )

  const winners = evaluateRules(rules, stats, already)
  if (!winners.length) return []

  const granted: GrantedReward[] = []
  for (const rule of winners) {
    const result = await grantOne(admin, ctx, rule, key, now)
    if (result) granted.push(result)
  }
  return granted
}

/**
 * Historial del cliente. Se cuenta por email/teléfono y no por customer_id
 * porque la mayoría de reservas son de invitados sin cuenta.
 */
async function buildCustomerStats(
  admin: ReturnType<typeof createAdminClient>,
  ctx: GrantContext,
  key: string,
): Promise<CustomerStats> {
  const isEmail = key.includes('@')

  let query = admin
    .from('bookings')
    .select('id, total_amount, completed_at, passenger_phone')
    .eq('company_id', ctx.companyId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(500)

  // Por email se filtra en la base (ilike, insensible a mayúsculas). Por
  // teléfono no se puede: se guarda con el formato que escribió el usuario
  // ("+1 809-555-1234"), y la clave está normalizada a solo dígitos. Ese caso
  // se filtra en memoria sobre el mismo resultado, sin una segunda consulta.
  if (isEmail) query = query.ilike('passenger_email', key)

  const { data: rows } = await query
  const trips = isEmail
    ? (rows ?? [])
    : (rows ?? []).filter((b) => (b.passenger_phone ?? '').replace(/\D/g, '') === key)

  const totalSpent = trips.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)

  // Días desde el viaje ANTERIOR a este. `trips` viene ordenado del más
  // reciente al más viejo, así que el actual es [0] y el previo [1].
  let daysSincePreviousTrip: number | null = null
  const current = trips.find((b) => b.id === ctx.bookingId) ?? trips[0]
  const previous = trips.find((b) => b.id !== ctx.bookingId)
  if (current?.completed_at && previous?.completed_at) {
    const diff = new Date(current.completed_at).getTime() - new Date(previous.completed_at).getTime()
    daysSincePreviousTrip = Math.floor(diff / 86_400_000)
  }

  return {
    tripsCompleted: trips.length,
    totalSpent,
    daysSincePreviousTrip,
    justSubmittedReview: ctx.justSubmittedReview,
    // Este flujo parte de un viaje o una reseña, nunca del calendario.
    isBirthdayToday: false,
  }
}

/**
 * Crea el código y registra el grant.
 *
 * El grant se inserta PRIMERO: su UNIQUE (rule_id, customer_key) es lo que
 * impide otorgar dos veces si dos eventos entran a la vez. Si ese insert
 * choca, alguien más ya ganó la carrera y aquí no se crea ningún código.
 * Al revés (código primero) se podrían crear códigos duplicados que ya
 * estarían en manos del cliente.
 */
async function grantOne(
  admin: ReturnType<typeof createAdminClient>,
  ctx: GrantContext,
  rule: RewardRule,
  key: string,
  now: Date,
): Promise<GrantedReward | null> {
  const { data: grant, error: grantError } = await admin
    .from('reward_grants')
    .insert({
      company_id: ctx.companyId,
      rule_id: rule.id,
      customer_key: key,
      customer_email: ctx.customerEmail,
      customer_phone: ctx.customerPhone,
      booking_id: ctx.bookingId,
      period_key: periodKeyFor(rule, now),
    })
    .select('id')
    .single()

  // 23505 = unique_violation: este cliente ya tenía esta recompensa (en este
  // mismo periodo — para cumpleaños, este mismo año).
  if (grantError) {
    if (grantError.code !== '23505') console.error('[grantOne] grant', grantError)
    return null
  }

  const code = buildRewardCode(rule.name, randomBytes(4))

  const { data: promo, error: promoError } = await admin
    .from('promo_codes')
    .insert({
      company_id: ctx.companyId,
      code,
      discount_type: rule.discountType,
      discount_value: rule.discountValue,
      // Personal e irrepetible: el código es de esta persona y de un solo uso.
      max_uses: 1,
      max_uses_per_customer: 1,
      valid_from: now.toISOString(),
      valid_until: expiresAt(rule, now),
      is_active: true,
    })
    .select('id')
    .single()

  if (promoError) {
    console.error('[grantOne] promo', promoError)
    // El grant queda registrado sin código. Es deliberado: reintentar crearía
    // un segundo código para alguien que quizá ya recibió el primero. Queda
    // visible en el panel para que el operador lo resuelva a mano.
    return null
  }

  await admin.from('reward_grants').update({ promo_code_id: promo.id }).eq('id', grant.id)

  return {
    ruleName: rule.name,
    code,
    discountType: rule.discountType,
    discountValue: rule.discountValue,
  }
}

/** Aviso al pasajero. Solo llega a quien tiene cuenta en la app. */
function notifyRewards(ctx: GrantContext, granted: GrantedReward[]) {
  const first = granted[0]!
  const amount =
    first.discountType === 'percentage' ? `${first.discountValue}%` : `$${first.discountValue}`

  notifyPassengerInBackground({
    customerId: ctx.customerId!,
    type: 'reward',
    title: '¡Tienes una recompensa!',
    body: `${amount} de descuento en tu próximo viaje con el código ${first.code}`,
    // El cumpleaños no tiene reserva asociada (ctx.bookingId es null): el
    // notificador acepta bookingId opcional para ese caso.
    bookingId: ctx.bookingId ?? undefined,
  })
}
