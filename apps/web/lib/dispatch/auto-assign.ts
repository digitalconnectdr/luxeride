// ── Auto-asignación justa de conductores ───────────────────────────────────────
// Para operadores (incluido uno solo, el propio dueño manejando) que no quieren
// asignar cada reserva a mano: al crear una reserva, o en el barrido diario de
// respaldo, se intenta asignar automáticamente al conductor "en servicio"
// (drivers.is_available, controlado por el conductor mismo) más adecuado.
//
// "Más adecuado" = sin choque de horario con otro viaje que ya tenga (ni el
// conductor ni el VEHÍCULO que trae asignado), y entre los que califican, el
// que MENOS viajes tenga asignados HOY (reparto justo — nadie se queda sin
// viajes mientras otro acumula). Activo para todas las empresas de la
// plataforma (sin interruptor de configuración).

import { createAdminClient } from '@/lib/supabase/server'
import { notify, notifyBookingEventInBackground } from '@/lib/notifications'
import { notifyDriverPushInBackground } from '@/lib/notifications/push'
import { notifyPassengerInBackground } from '@/lib/notifications/passenger-feed'
import { pushAdminNotification } from '@/lib/notifications/admin-feed'
import { getAppUrl } from '@/lib/app-url'
import { createAffiliatePoolTrips } from '@/app/actions/affiliates'
import {
  canAffiliateRespond,
  computeAffiliateReliability,
  isOperating,
  type AffiliateTripReliabilityInput,
  type AffiliateTripStatus,
} from '@/lib/affiliates/engine'
import { resolveZoneId, type ServiceZoneForMatch } from '@/lib/pricing/zones'
import {
  scoreDrivers,
  parseDispatchWeights,
  haversineMiles,
  type DriverScoreInput,
} from '@/lib/dispatch/scoring'

// Margen entre el fin estimado de un viaje y el inicio del siguiente para no
// considerarlos en conflicto — tiempo de traslado/descanso razonable.
const BUFFER_MINUTES = 45
// Duración asumida cuando el viaje no tiene duration_minutes calculado aún.
const DEFAULT_DURATION_MINUTES = 60
// Antigüedad máxima de una posición GPS para usarla como proximidad. Más vieja
// que esto ya no dice dónde está el conductor, dice dónde estuvo.
const PRESENCE_FRESHNESS_MINUTES = 90
// Ventana de rechazos que cuenta para la confiabilidad. Un mal mes no debe
// perseguir al conductor para siempre.
const REJECTION_LOOKBACK_DAYS = 30

interface AutoAssignBooking {
  id: string
  company_id: string
  booking_number: string
  scheduled_at: string
  duration_minutes: number | null
  passenger_name: string | null
  passenger_email: string | null
  passenger_phone: string | null
  pickup_location: unknown
  dropoff_location: unknown
  total_amount: number | null
  currency: string | null
}

export interface AutoAssignResult {
  assigned: boolean
  driverId?: string
}

export function windowFor(scheduledAt: string, durationMinutes: number | null): { start: number; end: number } {
  const start = new Date(scheduledAt).getTime() - BUFFER_MINUTES * 60_000
  const end = start + (BUFFER_MINUTES * 2 + (durationMinutes ?? DEFAULT_DURATION_MINUTES)) * 60_000
  return { start, end }
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * Intenta asignar automáticamente un conductor a una reserva recién creada
 * (status='pending', sin driver_id). No lanza — si no hay conductor elegible,
 * simplemente no asigna y la reserva queda pendiente para asignación manual
 * o el próximo barrido.
 */
export async function tryAutoAssignDriver(
  admin: ReturnType<typeof createAdminClient>,
  booking: AutoAssignBooking,
): Promise<AutoAssignResult> {
  // Respeta el interruptor Automático/Manual del Dispatch Board — si la
  // empresa lo apagó, la reserva se queda pendiente para asignación manual.
  const { data: company } = await admin
    .from('companies')
    .select('auto_assign_enabled, settings')
    .eq('id', booking.company_id)
    .single()
  if (company && company.auto_assign_enabled === false) return { assigned: false }

  const weights = parseDispatchWeights(
    (company?.settings as Record<string, unknown> | null)?.dispatch_weights,
  )

  // Tipo de vehículo pedido y punto de recogida: no vienen en AutoAssignBooking
  // (los tres call sites arman ese objeto con distintos SELECT), así que se
  // consultan aquí una sola vez para no tener que tocarlos.
  const { data: bookingDetails } = await admin
    .from('bookings')
    .select('vehicle_type_id, pickup_location')
    .eq('id', booking.id)
    .single()
  const requiredVehicleTypeId = bookingDetails?.vehicle_type_id ?? null
  const pickupPoint = bookingDetails?.pickup_location as { lat?: number; lng?: number } | null

  // Conductores en servicio de la empresa. Sección J: un conductor bloqueado
  // por compliance (licencia/permiso vencido) nunca es candidato, ni siquiera
  // si está marcado "disponible".
  const { data: availableDrivers } = await admin
    .from('drivers')
    .select('id, current_vehicle_id')
    .eq('company_id', booking.company_id)
    .eq('is_available', true)
    .eq('operational_block', false)
  const driverIds = (availableDrivers ?? []).map((d) => d.id)
  if (!driverIds.length) return { assigned: false }
  const currentVehicleByDriver = new Map((availableDrivers ?? []).map((d) => [d.id, d.current_vehicle_id]))

  // El vehículo que traen asignado tampoco puede estar bloqueado (seguro/
  // permiso for-hire/inspección vencidos) — si lo está, ese conductor queda
  // fuera hasta que se le reasigne un vehículo en regla.
  const vehicleIdsInPlay = Array.from(new Set(Array.from(currentVehicleByDriver.values()).filter((v): v is string => !!v)))
  const { data: vehicleBlockRows } = vehicleIdsInPlay.length
    ? await admin.from('vehicles').select('id, operational_block, vehicle_type_id').in('id', vehicleIdsInPlay)
    : { data: [] as { id: string; operational_block: boolean; vehicle_type_id: string | null }[] }
  const blockedVehicleIds = new Set((vehicleBlockRows ?? []).filter((v) => v.operational_block).map((v) => v.id))

  // Tipo de vehículo del carro que trae cada conductor — para no mandar un
  // sedán a una reserva que pidió (y pagó) una SUV. Solo excluye cuando el
  // tipo se CONOCE y no coincide: un conductor sin vehículo asignado sigue
  // siendo candidato, porque muchos operadores chicos no llevan
  // `current_vehicle_id` al día y excluirlos apagaría el dispatch entero.
  const typeByVehicleId = new Map((vehicleBlockRows ?? []).map((v) => [v.id, v.vehicle_type_id]))

  // Solo cuentan como "activos" los perfiles de conductor que siguen activos.
  const { data: activeProfiles } = await admin
    .from('user_profiles')
    .select('id')
    .in('id', driverIds)
    .eq('role', 'driver')
    .eq('is_active', true)
  const eligibleIds = new Set((activeProfiles ?? []).map((p) => p.id))
  if (!eligibleIds.size) return { assigned: false }

  // Viajes ya asignados/activos de esos conductores — solo para detectar
  // choques de horario con el nuevo viaje.
  const { data: activeBookings } = await admin
    .from('bookings')
    .select('driver_id, scheduled_at, duration_minutes')
    .in('driver_id', Array.from(eligibleIds))
    .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
    .neq('id', booking.id)

  const newWindow = windowFor(booking.scheduled_at, booking.duration_minutes)
  const conflicted = new Set<string>()
  for (const b of activeBookings ?? []) {
    if (!b.driver_id) continue
    const w = windowFor(b.scheduled_at, b.duration_minutes)
    if (overlaps(newWindow, w)) conflicted.add(b.driver_id)
  }

  // Conflicto de VEHÍCULO: el mismo vehículo no puede quedar comprometido en
  // dos viajes activos que se solapen, sin importar qué conductor los maneje
  // (ej. dos conductores de turnos distintos que comparten el mismo carro) —
  // por eso se consulta por `vehicle_id`, no solo por `driver_id` como arriba.
  const { data: activeVehicleBookings } = vehicleIdsInPlay.length
    ? await admin
        .from('bookings')
        .select('vehicle_id, scheduled_at, duration_minutes')
        .in('vehicle_id', vehicleIdsInPlay)
        .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
        .neq('id', booking.id)
    : { data: [] as { vehicle_id: string | null; scheduled_at: string; duration_minutes: number | null }[] }

  const vehicleConflicted = new Set<string>()
  for (const b of activeVehicleBookings ?? []) {
    if (!b.vehicle_id) continue
    const w = windowFor(b.scheduled_at, b.duration_minutes)
    if (overlaps(newWindow, w)) vehicleConflicted.add(b.vehicle_id)
  }

  // Reparto justo = menos viajes COMPLETADOS hoy. Si a un conductor le
  // cancelan/rechazan un viaje antes de empezarlo, ese viaje nunca llega a
  // 'completed' y por lo tanto no cuenta en su contra.
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const { data: completedToday } = await admin
    .from('bookings')
    .select('driver_id')
    .in('driver_id', Array.from(eligibleIds))
    .eq('status', 'completed')
    .gte('completed_at', todayStart.toISOString())

  const todayCount = new Map<string, number>()
  for (const b of completedToday ?? []) {
    if (!b.driver_id) continue
    todayCount.set(b.driver_id, (todayCount.get(b.driver_id) ?? 0) + 1)
  }

  const candidates = Array.from(eligibleIds).filter((id) => {
    if (conflicted.has(id)) return false
    const vehicleId = currentVehicleByDriver.get(id)
    if (vehicleId && blockedVehicleIds.has(vehicleId)) return false
    if (vehicleId && vehicleConflicted.has(vehicleId)) return false
    // Filtro duro de tipo de vehículo (ver typeByVehicleId arriba).
    if (requiredVehicleTypeId && vehicleId) {
      const driverType = typeByVehicleId.get(vehicleId)
      if (driverType && driverType !== requiredVehicleTypeId) return false
    }
    return true
  })
  if (!candidates.length) return { assigned: false }

  // ── Señales del score compuesto (ver lib/dispatch/scoring.ts) ──────────────

  // Proximidad: última posición reportada por la app del conductor. Se ignora
  // si está vieja — un GPS de ayer haría creer que el conductor sigue ahí.
  const presenceCutoff = new Date(Date.now() - PRESENCE_FRESHNESS_MINUTES * 60_000).toISOString()
  const { data: presenceRows } = await admin
    .from('driver_presence')
    .select('driver_id, latitude, longitude, updated_at')
    .in('driver_id', candidates)
    .gte('updated_at', presenceCutoff)

  const distanceByDriver = new Map<string, number>()
  if (typeof pickupPoint?.lat === 'number' && typeof pickupPoint?.lng === 'number') {
    for (const p of presenceRows ?? []) {
      distanceByDriver.set(
        p.driver_id,
        haversineMiles({ lat: p.latitude, lng: p.longitude }, { lat: pickupPoint.lat, lng: pickupPoint.lng }),
      )
    }
  }

  // Calificación promedio (la mantiene el trigger de driver_rating).
  const { data: ratingRows } = await admin
    .from('drivers')
    .select('id, rating')
    .in('id', candidates)
  const ratingByDriver = new Map((ratingRows ?? []).map((d) => [d.id, d.rating]))

  // Confiabilidad: rechazos recientes. `booking_events.actor_id` es el
  // conductor que rechazó, así que no hace falta pasar por bookings.
  const rejectionCutoff = new Date(Date.now() - REJECTION_LOOKBACK_DAYS * 86_400_000).toISOString()
  const { data: rejectionRows } = await admin
    .from('booking_events')
    .select('actor_id')
    .eq('company_id', booking.company_id)
    .eq('type', 'driver_rejected')
    .gte('created_at', rejectionCutoff)
    .in('actor_id', candidates)

  const rejectionsByDriver = new Map<string, number>()
  for (const r of rejectionRows ?? []) {
    if (!r.actor_id) continue
    rejectionsByDriver.set(r.actor_id, (rejectionsByDriver.get(r.actor_id) ?? 0) + 1)
  }

  const scoreInputs: DriverScoreInput[] = candidates.map((id) => ({
    driverId: id,
    tripsToday: todayCount.get(id) ?? 0,
    rating: ratingByDriver.get(id) ?? null,
    distanceMiles: distanceByDriver.get(id) ?? null,
    recentRejections: rejectionsByDriver.get(id) ?? 0,
  }))

  const ranked = scoreDrivers(scoreInputs, weights)
  const winner = ranked[0]
  const driverId = winner.driverId

  // Vehículo con el que el conductor está trabajando ahora mismo — así el
  // pasajero ve marca/placa en /track aunque la asignación haya sido automática.
  const vehicleId = currentVehicleByDriver.get(driverId) ?? null

  const now = new Date().toISOString()
  const { error } = await admin
    .from('bookings')
    .update({ driver_id: driverId, status: 'assigned', dispatched_at: now, ...(vehicleId ? { vehicle_id: vehicleId } : {}) })
    .eq('id', booking.id)
    .eq('status', 'pending') // guard de carrera: no pisar una asignación manual que llegó primero

  if (error) {
    console.error('[tryAutoAssignDriver]', error)
    return { assigned: false }
  }

  await admin.from('booking_events').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    type: 'driver_assigned',
    actor: 'system',
    reason: 'Auto-asignación',
    // El desglose queda en la bitácora: cuando el operador pregunte "¿por qué
    // le tocó a este?", la respuesta está en la reserva y no en un log.
    metadata: {
      driver_id: driverId,
      vehicle_id: vehicleId,
      auto: true,
      score: winner.total,
      score_breakdown: {
        proximity: winner.proximity,
        fairness: winner.fairness,
        rating: winner.rating,
        reliability: winner.reliability,
      },
      candidates: candidates.length,
      distance_miles: distanceByDriver.has(driverId)
        ? Math.round(distanceByDriver.get(driverId)! * 10) / 10
        : null,
    },
  })

  const pickup = (booking.pickup_location as { address?: string } | null)?.address ?? ''
  const dropoff = (booking.dropoff_location as { address?: string } | null)?.address ?? ''
  notifyBookingEventInBackground('driver_assigned', {
    companyId: booking.company_id,
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    passengerName: booking.passenger_name,
    passengerEmail: booking.passenger_email,
    passengerPhone: booking.passenger_phone,
    scheduledAt: booking.scheduled_at,
    pickupAddress: pickup,
    dropoffAddress: dropoff,
    totalAmount: booking.total_amount,
    currency: booking.currency ?? 'USD',
    extraVars: { tracking_url: `${getAppUrl()}/track/${booking.id}` },
  })

  notifyDriverPushInBackground(driverId, 'Nuevo viaje asignado', `${booking.booking_number} · ${pickup}`, {
    bookingId: booking.id,
    type: 'trip_assigned',
  })

  return { assigned: true, driverId }
}

// ── Sección G, Fase 5 — Auto-farm a la Red de Afiliados ────────────────────────
// Si no hay conductor propio disponible (tryAutoAssignDriver ya falló), y la
// empresa tiene la Red de Afiliados activa, se manda la reserva como un POOL
// (Fase 3) a sus afiliados aprobados, en vez de dejarla sin asignar hasta que
// alguien la mande a mano. El primero que acepta se la queda.
//
// Elegibilidad — un afiliado solo entra al pool si:
//   1. Tiene al menos un vehículo de la MISMA CLASE que pide la reserva
//      (vehicle_types.class es un enum compartido entre empresas; el id/name
//      del tipo es un valor propio de cada empresa y no se puede comparar
//      directo). Sin tipo requerido en la reserva → no se filtra por esto.
//   2. Su cobertura de zona incluye el punto de recogida (resolveZoneId). Un
//      afiliado sin ninguna zona definida se considera SIN restricción
//      (cobertura total) — la mayoría de afiliados chicos no configuran zonas.
//
// Priorización por score de confiabilidad — dos tandas, sin necesitar un
// trigger nuevo (el cron de barrido diario ya corre a diario y sirve de
// "tanda 2"):
//   - Tanda 1 (primer intento): solo la mitad superior de los candidatos
//     elegibles, ordenados por computeAffiliateReliability() (mejor tasa de
//     respuesta + puntualidad primero). Un afiliado sin historial aún recibe
//     un puntaje neutro (no se le penaliza por ser nuevo).
//   - Tanda 2: si la tanda 1 se cierra ENTERA sin que nadie acepte (todos
//     expiraron/rechazaron), el siguiente intento (el barrido diario) detecta
//     que ya no queda nadie con una solicitud viva y manda el resto de los
//     candidatos elegibles que no se probaron en la tanda 1.
// No se puede escalonar con un delay corto real (ej. "esperar 10 minutos y
// expandir") porque el plan actual de Vercel (Hobby) solo permite cron una
// vez al día — la tanda 2 depende de esa próxima corrida, no de un temporizador.

// Porcentaje del total cobrado al pasajero que se ofrece al afiliado por
// defecto — mismo espíritu que el resto del pricing: conservador, el
// dispatcher puede ajustar a mano después vía "Enviar a afiliado" si esto
// no encuentra tomador.
const AUTO_FARM_PAYOUT_PCT = 0.7

// Puntaje neutro para un afiliado sin historial todavía — no lo penaliza
// frente a uno con historial mediocre, ni lo prioriza sobre uno excelente.
const NEUTRAL_RELIABILITY_SCORE = 60

export interface AutoFarmResult {
  sent: boolean
  affiliateCount?: number
}

export async function tryAutoFarmToAffiliates(
  admin: ReturnType<typeof createAdminClient>,
  booking: AutoAssignBooking,
): Promise<AutoFarmResult> {
  if (!booking.total_amount || booking.total_amount <= 0) return { sent: false }

  // El barrido diario (cron/auto-assign) corre sobre TODA reserva pendiente
  // sin conductor, incluida una que ya farmeó por acá mismo en un intento
  // anterior. Si alguien ya está operando el viaje, no hay nada que hacer. Si
  // la tanda anterior sigue con solicitudes vivas (sin expirar), tampoco —
  // recién cuando esa tanda se cierra ENTERA (todas expiradas/rechazadas/
  // perdidas) se manda una tanda 2 a los afiliados que faltan por probar.
  const { data: existingTrips } = await admin
    .from('affiliate_trips')
    .select('company_affiliate_id, status, expires_at')
    .eq('booking_id', booking.id)

  if ((existingTrips ?? []).some((t) => isOperating(t.status as AffiliateTripStatus))) {
    return { sent: false }
  }
  if ((existingTrips ?? []).some((t) => canAffiliateRespond(t.status as AffiliateTripStatus, t.expires_at))) {
    return { sent: false }
  }
  const alreadyTriedIds = new Set((existingTrips ?? []).map((t) => t.company_affiliate_id))
  const isSecondWave = alreadyTriedIds.size > 0

  const { data: company } = await admin
    .from('companies')
    .select('affiliate_network_enabled')
    .eq('id', booking.company_id)
    .single()
  if (!company?.affiliate_network_enabled) return { sent: false }

  const { data: bookingDetails } = await admin
    .from('bookings')
    .select('vehicle_type_id, pickup_location')
    .eq('id', booking.id)
    .single()

  const { data: relations } = await admin
    .from('company_affiliates')
    .select('id, requester_company_id, affiliate_company_id')
    .eq('status', 'approved')
    .or(`requester_company_id.eq.${booking.company_id},affiliate_company_id.eq.${booking.company_id}`)

  const candidates = (relations ?? [])
    .filter((r) => !alreadyTriedIds.has(r.id))
    .map((r) => ({
      companyAffiliateId: r.id,
      affiliateCompanyId: r.requester_company_id === booking.company_id ? r.affiliate_company_id : r.requester_company_id,
    }))
  if (!candidates.length) return { sent: false }

  let eligibleCompanyIds = new Set(candidates.map((c) => c.affiliateCompanyId))

  // Filtro 1: tipo de vehículo. Solo aplica si la reserva pide una clase.
  if (bookingDetails?.vehicle_type_id) {
    const { data: requiredType } = await admin
      .from('vehicle_types')
      .select('class')
      .eq('id', bookingDetails.vehicle_type_id)
      .maybeSingle()

    if (requiredType?.class) {
      const { data: matchingTypes } = await admin
        .from('vehicle_types')
        .select('id')
        .in('company_id', Array.from(eligibleCompanyIds))
        .eq('class', requiredType.class)
        .eq('is_active', true)
      const matchingTypeIds = (matchingTypes ?? []).map((t) => t.id)

      const { data: matchingVehicles } = matchingTypeIds.length
        ? await admin
            .from('vehicles')
            .select('company_id')
            .in('vehicle_type_id', matchingTypeIds)
            .neq('status', 'retired')
            .eq('operational_block', false)
        : { data: [] as { company_id: string }[] }

      eligibleCompanyIds = new Set((matchingVehicles ?? []).map((v) => v.company_id))
    }
  }

  // Filtro 2: zona de servicio. Un afiliado sin zonas definidas no se filtra
  // (cobertura total); solo se excluye si tiene zonas Y el punto de recogida
  // cae fuera de todas ellas.
  const pickup = bookingDetails?.pickup_location as { lat?: number; lng?: number } | null
  if (eligibleCompanyIds.size && pickup?.lat != null && pickup?.lng != null) {
    const { data: allZones } = await admin
      .from('service_zones')
      .select('id, company_id, postal_codes, center_lat, center_lng, radius_miles')
      .in('company_id', Array.from(eligibleCompanyIds))
      .eq('is_active', true)

    const zonesByCompany = new Map<string, ServiceZoneForMatch[]>()
    for (const z of allZones ?? []) {
      const list = zonesByCompany.get(z.company_id) ?? []
      list.push(z)
      zonesByCompany.set(z.company_id, list)
    }

    eligibleCompanyIds = new Set(
      Array.from(eligibleCompanyIds).filter((companyId) => {
        const zones = zonesByCompany.get(companyId) ?? []
        if (!zones.length) return true
        return resolveZoneId(zones, { lat: pickup.lat!, lng: pickup.lng! }) != null
      }),
    )
  }

  const eligibleCandidates = candidates.filter((c) => eligibleCompanyIds.has(c.affiliateCompanyId))
  if (!eligibleCandidates.length) return { sent: false }

  // Priorizar por score de confiabilidad (ver comentario de arriba).
  const { data: history } = await admin
    .from('affiliate_trips')
    .select('affiliate_company_id, status, created_at, responded_at, preview_scheduled_at, arrived_at')
    .in('affiliate_company_id', Array.from(eligibleCompanyIds))

  const historyByCompany = new Map<string, AffiliateTripReliabilityInput[]>()
  for (const h of history ?? []) {
    const list = historyByCompany.get(h.affiliate_company_id) ?? []
    list.push({
      status: h.status as AffiliateTripStatus,
      createdAt: h.created_at,
      respondedAt: h.responded_at,
      previewScheduledAt: h.preview_scheduled_at,
      arrivedAt: h.arrived_at,
    })
    historyByCompany.set(h.affiliate_company_id, list)
  }

  function reliabilityScore(companyId: string): number {
    const reliability = computeAffiliateReliability(historyByCompany.get(companyId) ?? [])
    const responseRate = reliability.responseRatePct ?? NEUTRAL_RELIABILITY_SCORE
    const punctuality = reliability.punctualityPct ?? NEUTRAL_RELIABILITY_SCORE
    return responseRate * 0.6 + punctuality * 0.4
  }

  eligibleCandidates.sort((a, b) => reliabilityScore(b.affiliateCompanyId) - reliabilityScore(a.affiliateCompanyId))

  // Tanda 1 = mitad superior por score (mínimo 2, para no reducir demasiado
  // el pool en el primer intento). Tanda 2 = el resto, ya sin volver a cortar.
  const wave = isSecondWave
    ? eligibleCandidates
    : eligibleCandidates.slice(0, Math.max(2, Math.ceil(eligibleCandidates.length / 2)))
  if (!wave.length) return { sent: false }

  const offeredPrice = Math.round(booking.total_amount * AUTO_FARM_PAYOUT_PCT * 100) / 100

  const result = await createAffiliatePoolTrips(admin, {
    bookingId: booking.id,
    ownerCompanyId: booking.company_id,
    companyAffiliateIds: wave.map((c) => c.companyAffiliateId),
    reason: 'no_driver',
    offeredPrice,
    brandingMode: 'white_label',
    requestedBy: null,
  })

  if (!result.success) return { sent: false }
  return { sent: true, affiliateCount: wave.length }
}

// ── Protocolo de respaldo (Guaranteed Ride) ────────────────────────────────────
// Reasigna DENTRO de la misma flota cuando lib/dispatch/risk.ts detecta que el
// conductor ya asignado corre riesgo real de no llegar a tiempo. Reusa el
// mismo criterio de candidatos que tryAutoAssignDriver (misma empresa,
// disponible, sin choque de horario, tipo de vehículo compatible), EXCLUYENDO
// al conductor actual — es una reasignación, no una asignación desde cero.

interface RiskReassignBooking {
  id: string
  company_id: string
  booking_number: string
  scheduled_at: string
  duration_minutes: number | null
  driver_id: string // conductor en riesgo, a reemplazar
  customer_id: string | null
  vehicle_type_id: string | null
  pickup_location: unknown
  dropoff_location: unknown
  passenger_name: string | null
  passenger_email: string | null
  passenger_phone: string | null
  total_amount: number | null
  currency: string | null
}

export interface ReassignForRiskResult {
  reassigned: boolean
  newDriverId?: string
}

export async function reassignForRisk(
  admin: ReturnType<typeof createAdminClient>,
  booking: RiskReassignBooking,
): Promise<ReassignForRiskResult> {
  const previousDriverId = booking.driver_id

  const { data: company } = await admin
    .from('companies')
    .select('settings, name')
    .eq('id', booking.company_id)
    .single()
  const weights = parseDispatchWeights((company?.settings as Record<string, unknown> | null)?.dispatch_weights)

  const pickupPoint = booking.pickup_location as { lat?: number; lng?: number; address?: string } | null

  const { data: availableDrivers } = await admin
    .from('drivers')
    .select('id, current_vehicle_id')
    .eq('company_id', booking.company_id)
    .eq('is_available', true)
    .eq('operational_block', false)
    .neq('id', previousDriverId)
  const driverIds = (availableDrivers ?? []).map((d) => d.id)
  if (!driverIds.length) {
    await pushAdminNotification({
      companyId: booking.company_id,
      type: 'risk_reassign_failed',
      title: `Sin respaldo disponible para ${booking.booking_number}`,
      detail: 'El protocolo de respaldo detectó riesgo pero no hay ningún otro conductor disponible. Revisa el viaje ya mismo.',
      href: `/admin/bookings/${booking.id}`,
      sourceTable: 'bookings',
      sourceId: booking.id,
      dedupDays: 1,
    })
    return { reassigned: false }
  }
  const currentVehicleByDriver = new Map((availableDrivers ?? []).map((d) => [d.id, d.current_vehicle_id]))

  const vehicleIdsInPlay = Array.from(new Set(Array.from(currentVehicleByDriver.values()).filter((v): v is string => !!v)))
  const { data: vehicleBlockRows } = vehicleIdsInPlay.length
    ? await admin.from('vehicles').select('id, operational_block, vehicle_type_id').in('id', vehicleIdsInPlay)
    : { data: [] as { id: string; operational_block: boolean; vehicle_type_id: string | null }[] }
  const blockedVehicleIds = new Set((vehicleBlockRows ?? []).filter((v) => v.operational_block).map((v) => v.id))
  const typeByVehicleId = new Map((vehicleBlockRows ?? []).map((v) => [v.id, v.vehicle_type_id]))

  const { data: activeProfiles } = await admin
    .from('user_profiles')
    .select('id')
    .in('id', driverIds)
    .eq('role', 'driver')
    .eq('is_active', true)
  const eligibleIds = new Set((activeProfiles ?? []).map((p) => p.id))
  if (!eligibleIds.size) {
    await pushAdminNotification({
      companyId: booking.company_id,
      type: 'risk_reassign_failed',
      title: `Sin respaldo disponible para ${booking.booking_number}`,
      detail: 'El protocolo de respaldo detectó riesgo pero no hay ningún otro conductor disponible. Revisa el viaje ya mismo.',
      href: `/admin/bookings/${booking.id}`,
      sourceTable: 'bookings',
      sourceId: booking.id,
      dedupDays: 1,
    })
    return { reassigned: false }
  }

  const { data: activeBookings } = await admin
    .from('bookings')
    .select('driver_id, scheduled_at, duration_minutes')
    .in('driver_id', Array.from(eligibleIds))
    .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
    .neq('id', booking.id)

  const newWindow = windowFor(booking.scheduled_at, booking.duration_minutes)
  const conflicted = new Set<string>()
  for (const b of activeBookings ?? []) {
    if (!b.driver_id) continue
    if (overlaps(newWindow, windowFor(b.scheduled_at, b.duration_minutes))) conflicted.add(b.driver_id)
  }

  const { data: activeVehicleBookings } = vehicleIdsInPlay.length
    ? await admin
        .from('bookings')
        .select('vehicle_id, scheduled_at, duration_minutes')
        .in('vehicle_id', vehicleIdsInPlay)
        .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
        .neq('id', booking.id)
    : { data: [] as { vehicle_id: string | null; scheduled_at: string; duration_minutes: number | null }[] }
  const vehicleConflicted = new Set<string>()
  for (const b of activeVehicleBookings ?? []) {
    if (!b.vehicle_id) continue
    if (overlaps(newWindow, windowFor(b.scheduled_at, b.duration_minutes))) vehicleConflicted.add(b.vehicle_id)
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const { data: completedToday } = await admin
    .from('bookings')
    .select('driver_id')
    .in('driver_id', Array.from(eligibleIds))
    .eq('status', 'completed')
    .gte('completed_at', todayStart.toISOString())
  const todayCount = new Map<string, number>()
  for (const b of completedToday ?? []) {
    if (!b.driver_id) continue
    todayCount.set(b.driver_id, (todayCount.get(b.driver_id) ?? 0) + 1)
  }

  const candidates = Array.from(eligibleIds).filter((id) => {
    if (conflicted.has(id)) return false
    const vehicleId = currentVehicleByDriver.get(id)
    if (vehicleId && blockedVehicleIds.has(vehicleId)) return false
    if (vehicleId && vehicleConflicted.has(vehicleId)) return false
    if (booking.vehicle_type_id && vehicleId) {
      const driverType = typeByVehicleId.get(vehicleId)
      if (driverType && driverType !== booking.vehicle_type_id) return false
    }
    return true
  })
  if (!candidates.length) {
    await pushAdminNotification({
      companyId: booking.company_id,
      type: 'risk_reassign_failed',
      title: `Sin respaldo disponible para ${booking.booking_number}`,
      detail: 'El protocolo de respaldo detectó riesgo pero ningún otro conductor calificó (choque de horario o tipo de vehículo). Revisa el viaje ya mismo.',
      href: `/admin/bookings/${booking.id}`,
      sourceTable: 'bookings',
      sourceId: booking.id,
      dedupDays: 1,
    })
    return { reassigned: false }
  }

  const presenceCutoff = new Date(Date.now() - 90 * 60_000).toISOString()
  const { data: presenceRows } = await admin
    .from('driver_presence')
    .select('driver_id, latitude, longitude, updated_at')
    .in('driver_id', candidates)
    .gte('updated_at', presenceCutoff)
  const distanceByDriver = new Map<string, number>()
  if (typeof pickupPoint?.lat === 'number' && typeof pickupPoint?.lng === 'number') {
    for (const p of presenceRows ?? []) {
      distanceByDriver.set(p.driver_id, haversineMiles({ lat: p.latitude, lng: p.longitude }, { lat: pickupPoint.lat, lng: pickupPoint.lng }))
    }
  }

  const { data: ratingRows } = await admin.from('drivers').select('id, rating').in('id', candidates)
  const ratingByDriver = new Map((ratingRows ?? []).map((d) => [d.id, d.rating]))

  const rejectionCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: rejectionRows } = await admin
    .from('booking_events')
    .select('actor_id')
    .eq('company_id', booking.company_id)
    .eq('type', 'driver_rejected')
    .gte('created_at', rejectionCutoff)
    .in('actor_id', candidates)
  const rejectionsByDriver = new Map<string, number>()
  for (const r of rejectionRows ?? []) {
    if (!r.actor_id) continue
    rejectionsByDriver.set(r.actor_id, (rejectionsByDriver.get(r.actor_id) ?? 0) + 1)
  }

  const scoreInputs: DriverScoreInput[] = candidates.map((id) => ({
    driverId: id,
    tripsToday: todayCount.get(id) ?? 0,
    rating: ratingByDriver.get(id) ?? null,
    distanceMiles: distanceByDriver.get(id) ?? null,
    recentRejections: rejectionsByDriver.get(id) ?? 0,
  }))
  const winner = scoreDrivers(scoreInputs, weights)[0]
  const newDriverId = winner.driverId
  const newVehicleId = currentVehicleByDriver.get(newDriverId) ?? null

  const now = new Date().toISOString()
  const { error, data: updated } = await admin
    .from('bookings')
    .update({ driver_id: newDriverId, dispatched_at: now, ...(newVehicleId ? { vehicle_id: newVehicleId } : {}) })
    .eq('id', booking.id)
    .eq('driver_id', previousDriverId) // guard de carrera: no pisar si ya cambió mientras tanto
    .select('id')

  if (error || !updated?.length) {
    if (error) console.error('[reassignForRisk]', error)
    return { reassigned: false }
  }

  await admin.from('booking_events').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    type: 'driver_reassigned',
    actor: 'system',
    reason: 'Protocolo de respaldo — riesgo de retraso detectado',
    metadata: { auto: true, reason: 'risk_detected', previous_driver_id: previousDriverId, new_driver_id: newDriverId },
  })

  const { data: prevDriver } = await admin.from('user_profiles').select('phone').eq('id', previousDriverId).single()
  if (prevDriver?.phone) {
    notify({
      companyId: booking.company_id,
      channel: 'sms',
      type: 'driver_unassigned',
      recipient: prevDriver.phone,
      vars: { booking_number: booking.booking_number },
      bookingId: booking.id,
    }).catch((err) => console.error('[reassignForRisk] driver_unassigned notify', err))
  }

  notifyDriverPushInBackground(newDriverId, 'Nuevo viaje asignado', `${booking.booking_number} · ${pickupPoint?.address ?? ''}`, {
    bookingId: booking.id,
    type: 'trip_assigned',
  })

  // Pasajero: copy tranquilizador y distinto del "conductor asignado" genérico
  // — el punto del Guaranteed Ride es que el pasajero SEPA que hubo un
  // respaldo automático, no que note un cambio sin explicación.
  const reassuranceVars = { booking_number: booking.booking_number }
  if (booking.passenger_email) {
    notify({
      companyId: booking.company_id,
      channel: 'email',
      type: 'driver_reassigned_reassurance',
      recipient: booking.passenger_email,
      vars: reassuranceVars,
      bookingId: booking.id,
    }).catch((err) => console.error('[reassignForRisk] passenger email notify', err))
  }
  if (booking.passenger_phone) {
    notify({
      companyId: booking.company_id,
      channel: 'sms',
      type: 'driver_reassigned_reassurance',
      recipient: booking.passenger_phone,
      vars: reassuranceVars,
      bookingId: booking.id,
    }).catch((err) => console.error('[reassignForRisk] passenger sms notify', err))
  }
  if (booking.customer_id) {
    notifyPassengerInBackground({
      customerId: booking.customer_id,
      type: 'driver_assigned',
      title: 'Ya te asignamos otro conductor',
      body: `Por tu tranquilidad, un conductor certificado ya va en camino — ${booking.booking_number}`,
      bookingId: booking.id,
    })
  }

  return { reassigned: true, newDriverId }
}
