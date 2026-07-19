'use server'
// ── F1.8 — Booking Engine: Server Actions ─────────────────────────────────────
// SECURITY: Precios siempre calculados server-side. Frontend NUNCA envía montos.
// OWASP Top 10 compliant — inputs validados, admin client para inserts en price_quotes.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { calculateRoute } from '@/lib/maps/routes'
import {
  parsePolicy,
  parseBookingWindow,
  parseOperatingHours,
  computeCancellationFee,
  validateBookingTime,
  validateOperatingHours,
} from '@/lib/policy/engine'
import { waitUntil } from '@vercel/functions'
import { notifyBookingEventInBackground, notify } from '@/lib/notifications'
import { notifyDriverPushInBackground } from '@/lib/notifications/push'
import { trackBookingFlight } from '@/lib/flights/refresh'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'
import { checkMonthlyBookingLimit } from '@/lib/plans/limits'
import { getAppUrl } from '@/lib/app-url'
import { calculateFare, bestRule, type PricingRuleFields } from '@/lib/pricing/engine'
import { resolveZoneId, type ServiceZoneForMatch } from '@/lib/pricing/zones'
import { tryAutoAssignDriver, tryAutoFarmToAffiliates, windowFor, overlaps } from '@/lib/dispatch/auto-assign'
import { isAddonActive } from '@/lib/billing/addons'
import { validatePromoCode, computeDiscount } from '@/lib/promo/engine'
import { applyPartnerRateAdjustment } from '@/lib/partners/engine'
import type { BookingStatus, BookingType, Json } from '@/lib/supabase/database.types'

// ─── Multi-stop: validación de paradas intermedias ────────────────────────────

export interface StopInput {
  address: string
  lat: number
  lng: number
}

const MAX_STOPS = 3

function sanitizeStops(stops: StopInput[] | undefined): StopInput[] {
  if (!stops?.length) return []
  return stops
    .filter(
      (s) =>
        Number.isFinite(s.lat) && Number.isFinite(s.lng) &&
        s.lat !== 0 && s.lng !== 0 &&
        typeof s.address === 'string' && s.address.trim().length > 0,
    )
    .slice(0, MAX_STOPS)
    .map((s) => ({ address: s.address.trim().slice(0, 500), lat: s.lat, lng: s.lng }))
}

/** Extrae paradas de un FormData (stop_0, stop_0_lat, stop_0_lng, …) */
function stopsFromFormData(formData: FormData): StopInput[] {
  const stops: StopInput[] = []
  for (let i = 0; i < MAX_STOPS; i++) {
    const address = (formData.get(`stop_${i}`) as string)?.trim()
    const lat = parseFloat(formData.get(`stop_${i}_lat`) as string)
    const lng = parseFloat(formData.get(`stop_${i}_lng`) as string)
    if (address && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      stops.push({ address, lat, lng })
    }
  }
  return sanitizeStops(stops)
}

// ─── Helper: datos de notificación desde una fila de booking ──────────────────

interface BookingNotifyRow {
  id: string
  company_id: string
  booking_number: string
  passenger_name: string | null
  passenger_email: string | null
  passenger_phone: string | null
  scheduled_at: string
  pickup_location: unknown
  dropoff_location: unknown
  total_amount: number | null
  currency: string | null
}

function toNotifyData(b: BookingNotifyRow, extraVars?: Record<string, string>) {
  const pickup  = (b.pickup_location as { address?: string } | null)?.address ?? ''
  const dropoff = (b.dropoff_location as { address?: string } | null)?.address ?? ''
  return {
    companyId: b.company_id,
    bookingId: b.id,
    bookingNumber: b.booking_number,
    passengerName: b.passenger_name,
    passengerEmail: b.passenger_email,
    passengerPhone: b.passenger_phone,
    scheduledAt: b.scheduled_at,
    pickupAddress: pickup,
    dropoffAddress: dropoff,
    totalAmount: b.total_amount,
    currency: b.currency ?? 'USD',
    extraVars,
  }
}

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface QuoteResult {
  quoteId: string
  baseAmount: number
  surchargeAmount: number
  totalAmount: number
  currency: string
  distanceMiles: number | null
  durationMinutes: number | null
}

export interface BookingResult {
  bookingId: string
  bookingNumber: string
}

export interface VehicleQuote {
  vehicleType: {
    id: string
    name: string
    class: string
    capacity: number
    amenities: string[]
  }
  quoteId: string
  baseAmount: number
  surchargeAmount: number
  totalAmount: number
  currency: string
  distanceMiles: number | null
  durationMinutes: number | null
  noPrice: boolean
}

// ─── Máquina de estados — transiciones válidas ────────────────────────────────

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  quote:       ['pending', 'cancelled'],
  pending:     ['assigned', 'cancelled'],
  assigned:    ['en_route', 'cancelled', 'no_show'],
  en_route:    ['arrived', 'cancelled'],
  arrived:     ['in_progress', 'no_show'],
  in_progress: ['completed', 'failed'],
  completed:   [],
  cancelled:   [],
  no_show:     [],
  failed:      [],
}

// El cálculo de tarifa vive en lib/pricing/engine.ts (puro + timezone-aware).

// ─── Admin: Calcular cotización ───────────────────────────────────────────────

export async function calculateQuoteAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; data?: QuoteResult }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const pickupLat    = parseFloat(formData.get('pickup_lat')  as string)
  const pickupLng    = parseFloat(formData.get('pickup_lng')  as string)
  const pickupAddr   = (formData.get('pickup')  as string) ?? ''
  const pickupPostalCode  = (formData.get('pickup_postal_code')  as string) || null
  const dropoffLat   = parseFloat(formData.get('dropoff_lat') as string)
  const dropoffLng   = parseFloat(formData.get('dropoff_lng') as string)
  const dropoffAddr  = (formData.get('dropoff') as string) ?? ''
  const dropoffPostalCode = (formData.get('dropoff_postal_code') as string) || null
  const vehicleTypeId = (formData.get('vehicle_type_id') as string) || null
  const scheduledAtStr = formData.get('scheduled_at') as string
  const bookingType  = ((formData.get('booking_type') as string) || 'one_way') as BookingType

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return { success: false, error: 'Coordenadas de pickup/dropoff requeridas. Selecciona la dirección del dropdown.' }
  }
  if (!scheduledAtStr) return { success: false, error: 'Fecha y hora requeridas' }

  const stops = stopsFromFormData(formData)
  const scheduledAt = new Date(scheduledAtStr)
  const admin = createAdminClient()

  // Timezone de la empresa para recargos nocturnos/fin de semana
  const { data: companyTz } = await admin
    .from('companies')
    .select('timezone')
    .eq('id', user.company_id)
    .single()

  // Obtener reglas de precio + zonas activas (para precio "Por zona")
  const [{ data: rulesRaw }, { data: zonesRaw }] = await Promise.all([
    admin
      .from('pricing_rules')
      .select('id, model, base_price, per_mile_rate, per_km_rate, hourly_rate, minimum_fare, origin_zone_id, destination_zone_id, airport_pickup_fee, airport_dropoff_fee, night_surcharge_pct, weekend_surcharge_pct, surge_enabled, surge_multiplier, vehicle_type_id, priority')
      .eq('company_id', user.company_id)
      .eq('is_active', true)
      .order('priority', { ascending: false }),
    admin
      .from('service_zones')
      .select('id, postal_codes, center_lat, center_lng, radius_miles')
      .eq('company_id', user.company_id)
      .eq('is_active', true),
  ])

  if (!rulesRaw?.length) {
    return { success: false, error: 'No hay reglas de precio activas. Configura precios en /admin/pricing.' }
  }

  const zones = (zonesRaw ?? []) as ServiceZoneForMatch[]
  const originZoneId = resolveZoneId(zones, { lat: pickupLat, lng: pickupLng, postalCode: pickupPostalCode })
  const destinationZoneId = resolveZoneId(zones, { lat: dropoffLat, lng: dropoffLng, postalCode: dropoffPostalCode })

  const rule = bestRule(rulesRaw as unknown as PricingRuleFields[], vehicleTypeId, { originZoneId, destinationZoneId })
  if (!rule) {
    return {
      success: false,
      error:
        'Este tipo de vehículo no tiene una regla de precio aplicable. En /admin/pricing crea una regla para este tipo de vehículo, o una regla general (selecciona "Todos los tipos").',
    }
  }

  // Calcular ruta (incluye paradas intermedias si las hay)
  const route = await calculateRoute(pickupLat, pickupLng, dropoffLat, dropoffLng, stops)
  const distanceMiles  = route?.distanceMi ?? 0
  const durationMinutes = route?.durationMinutes ?? 0

  const fare = calculateFare(
    rule, distanceMiles, durationMinutes, scheduledAt, bookingType, companyTz?.timezone,
  )

  // Guardar cotización (admin client — no hay INSERT policy de usuario en price_quotes)
  const { data: quote, error } = await admin
    .from('price_quotes')
    .insert({
      company_id:      user.company_id,
      pricing_rule_id: rule.id,
      vehicle_type_id: vehicleTypeId,
      pickup_lat:      pickupLat,
      pickup_lng:      pickupLng,
      pickup_address:  pickupAddr,
      dropoff_lat:     dropoffLat,
      dropoff_lng:     dropoffLng,
      dropoff_address: dropoffAddr,
      distance_miles:  distanceMiles || null,
      duration_minutes: durationMinutes || null,
      route_polyline:  route?.polyline ?? null,
      base_amount:     fare.baseAmount,
      surcharge_amount: fare.surchargeAmount,
      total_amount:    fare.totalAmount,
      currency:        'USD',
    })
    .select('id')
    .single()

  if (error || !quote) {
    console.error('[calculateQuoteAction]', error)
    return { success: false, error: 'Error al guardar cotización' }
  }

  return {
    success: true,
    data: {
      quoteId:         quote.id,
      baseAmount:      fare.baseAmount,
      surchargeAmount: fare.surchargeAmount,
      totalAmount:     fare.totalAmount,
      currency:        'USD',
      distanceMiles:   distanceMiles || null,
      durationMinutes: durationMinutes || null,
    },
  }
}

// ─── Admin: Crear reservación ─────────────────────────────────────────────────

export async function createBookingAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; data?: BookingResult }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const quoteId = formData.get('quote_id') as string
  if (!quoteId) return { success: false, error: 'Cotización requerida. Calcula el precio primero.' }

  const admin = createAdminClient()

  // Validar cotización — siempre del server (nunca del cliente)
  const { data: quote } = await admin
    .from('price_quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('company_id', user.company_id)
    .eq('is_used', false)
    .single()

  if (!quote) return { success: false, error: 'Cotización no encontrada o ya utilizada' }
  if (new Date(quote.expires_at) < new Date()) {
    return { success: false, error: 'La cotización ha expirado. Recalcula el precio.' }
  }

  const pickupAddr   = formData.get('pickup')  as string
  const pickupLat    = parseFloat(formData.get('pickup_lat')  as string)
  const pickupLng    = parseFloat(formData.get('pickup_lng')  as string)
  const dropoffAddr  = formData.get('dropoff') as string
  const dropoffLat   = parseFloat(formData.get('dropoff_lat') as string)
  const dropoffLng   = parseFloat(formData.get('dropoff_lng') as string)
  const scheduledAt  = formData.get('scheduled_at') as string
  const bookingType  = ((formData.get('booking_type') as string) || 'one_way') as BookingType
  const passengerName  = (formData.get('passenger_name') as string)?.trim()
  const passengerPhone = (formData.get('passenger_phone') as string)?.trim()
  const passengerEmail = (formData.get('passenger_email') as string)?.trim()
  const passengerCount = parseInt(formData.get('passenger_count') as string) || 1
  const specialInstructions = (formData.get('special_instructions') as string)?.trim()
  const internalNotes = (formData.get('internal_notes') as string)?.trim()
  const flightNumber  = (formData.get('flight_number') as string)?.trim()
  const meetAndGreet  = formData.get('meet_and_greet') === 'true'
  const corporateAccountId = (formData.get('corporate_account_id') as string)?.trim() || null
  // Pipeline de cotizaciones: guardar como cotización (status 'quote') en vez de confirmar.
  const asQuote = formData.get('as_quote') === 'true'

  if (!passengerName) return { success: false, error: 'Nombre del pasajero requerido' }
  if (!scheduledAt)   return { success: false, error: 'Fecha y hora requeridas' }
  if (!pickupAddr)    return { success: false, error: 'Dirección de pickup requerida' }
  if (!dropoffAddr)   return { success: false, error: 'Dirección de dropoff requerida' }

  // Las cotizaciones guardadas (as_quote) no cuentan contra el límite mensual
  // del plan — solo reservas reales (pending/confirmed en adelante).
  if (!asQuote) {
    const limitCheck = await checkMonthlyBookingLimit(admin, user.company_id)
    if (!limitCheck.ok) return { success: false, error: limitCheck.error }
  }

  // F1.11 — validar que la cuenta corporativa pertenece a la empresa y está activa
  if (corporateAccountId) {
    const { data: corpAccount } = await admin
      .from('corporate_accounts')
      .select('id, is_active')
      .eq('id', corporateAccountId)
      .eq('company_id', user.company_id)
      .single()

    if (!corpAccount || !corpAccount.is_active) {
      return { success: false, error: 'Cuenta corporativa no válida o inactiva' }
    }
  }

  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      company_id:       user.company_id,
      status:           asQuote ? 'quote' : 'pending',
      type:             bookingType,
      vehicle_type_id:  quote.vehicle_type_id,
      corporate_account_id: corporateAccountId,
      passenger_count:  passengerCount,
      passenger_name:   passengerName,
      passenger_phone:  passengerPhone || null,
      passenger_email:  passengerEmail || null,
      pickup_location:  { address: pickupAddr,  lat: pickupLat,  lng: pickupLng  },
      dropoff_location: { address: dropoffAddr, lat: dropoffLat, lng: dropoffLng },
      waypoints:        stopsFromFormData(formData) as unknown as Json[],
      scheduled_at:     scheduledAt,
      flight_number:    flightNumber || null,
      special_instructions: specialInstructions || null,
      internal_notes:   internalNotes || null,
      meet_and_greet:   meetAndGreet,
      price_quote_id:   quoteId,
      // Montos SIEMPRE del quote (server-calculated) — nunca del form
      base_amount:      quote.base_amount,
      total_amount:     quote.total_amount,
      currency:         quote.currency ?? 'USD',
      distance_miles:   quote.distance_miles,
      duration_minutes: quote.duration_minutes,
      route_polyline:   quote.route_polyline,
      created_by:       user.id,
    })
    .select('id, booking_number')
    .single()

  if (error || !booking) {
    console.error('[createBookingAction]', error)
    return { success: false, error: 'Error al crear reservación' }
  }

  // Audit trail — quién creó la reserva desde el panel (las públicas del
  // micrositio no tienen staff que las cree, así que no emiten este evento).
  await admin.from('booking_events').insert({
    booking_id: booking.id,
    company_id: user.company_id,
    type: 'created',
    actor: 'dispatcher',
    actor_id: user.id,
    metadata: { as_quote: asQuote },
  })

  // Marcar cotización como usada
  await admin.from('price_quotes').update({ is_used: true }).eq('id', quoteId)

  // Crear líneas de cargo (booking_fees)
  const fees: { booking_id: string; company_id: string; type: string; description: string; amount: number }[] = []
  if (quote.base_amount > 0) {
    fees.push({ booking_id: booking.id, company_id: user.company_id, type: 'base', description: 'Tarifa base', amount: quote.base_amount })
  }
  if (quote.surcharge_amount && quote.surcharge_amount > 0) {
    fees.push({ booking_id: booking.id, company_id: user.company_id, type: 'surcharge', description: 'Recargo', amount: quote.surcharge_amount })
  }
  if (fees.length > 0) await admin.from('booking_fees').insert(fees)

  // Auto-asignación a un conductor en servicio (best-effort — si no hay
  // conductores disponibles o hay choque de horario, la reserva queda
  // pendiente igual que antes, para asignación manual o el barrido diario).
  if (!asQuote) {
    try {
      const autoAssignBooking = {
        id: booking.id,
        company_id: user.company_id,
        booking_number: booking.booking_number,
        scheduled_at: scheduledAt,
        duration_minutes: quote.duration_minutes,
        passenger_name: passengerName,
        passenger_email: passengerEmail || null,
        passenger_phone: passengerPhone || null,
        pickup_location: { address: pickupAddr },
        dropoff_location: { address: dropoffAddr },
        total_amount: quote.total_amount,
        currency: quote.currency ?? 'USD',
      }
      const result = await tryAutoAssignDriver(admin, autoAssignBooking)
      if (!result.assigned) await tryAutoFarmToAffiliates(admin, autoAssignBooking)
    } catch (e) {
      console.error('[createBookingAction] auto-assign', e)
    }
  }

  // Flight tracking — consulta el vuelo en background si aplica
  if (flightNumber && ['airport_pickup', 'airport_dropoff'].includes(bookingType)) {
    waitUntil(trackBookingFlight(user.company_id, booking.id, flightNumber))
  }

  // F1.14 — confirmación al pasajero (email + SMS). Si es cotización aún NO se
  // confirma, así que no se envía la confirmación (se enviará al convertirla).
  if (!asQuote) {
    notifyBookingEventInBackground('booking_confirmation', toNotifyData({
      id: booking.id,
      company_id: user.company_id,
      booking_number: booking.booking_number,
      passenger_name: passengerName,
      passenger_email: passengerEmail || null,
      passenger_phone: passengerPhone || null,
      scheduled_at: scheduledAt,
      pickup_location: { address: pickupAddr },
      dropoff_location: { address: dropoffAddr },
      total_amount: quote.total_amount,
      currency: quote.currency,
    }))
  }

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/quotes')
  revalidatePath('/admin/dashboard')
  return {
    success: true,
    data: { bookingId: booking.id, bookingNumber: booking.booking_number },
  }
}

// ─── Admin: Actualizar estado (máquina de estados) ────────────────────────────

export async function updateBookingStatusAction(
  bookingId: string,
  newStatus: BookingStatus,
  opts?: { reason?: string },
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, scheduled_at, total_amount, booking_number, passenger_name, passenger_email, passenger_phone, pickup_location, dropoff_location, currency')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .single()

  if (!booking) return { success: false, error: 'Reservación no encontrada' }

  const current = booking.status as BookingStatus
  const allowed = VALID_TRANSITIONS[current] ?? []
  if (!allowed.includes(newStatus)) {
    return { success: false, error: `Transición inválida: ${current} → ${newStatus}` }
  }

  const now = new Date().toISOString()
  const updates: {
    status: BookingStatus
    dispatched_at?: string
    en_route_at?: string
    arrived_at?: string
    started_at?: string
    completed_at?: string
    cancelled_at?: string
    no_show_at?: string
    cancellation_reason?: string | null
    cancelled_by?: string | null
  } = { status: newStatus }

  if (newStatus === 'assigned')    updates.dispatched_at = now
  if (newStatus === 'en_route')    updates.en_route_at   = now
  if (newStatus === 'arrived')     updates.arrived_at    = now
  if (newStatus === 'in_progress') updates.started_at    = now
  if (newStatus === 'completed')   updates.completed_at  = now
  if (newStatus === 'cancelled')   updates.cancelled_at  = now
  if (newStatus === 'no_show')     updates.no_show_at    = now

  if (newStatus === 'cancelled' && opts?.reason) {
    updates.cancellation_reason = opts.reason
    updates.cancelled_by = user.id
  }

  const { error } = await admin.from('bookings').update(updates).eq('id', bookingId)
  if (error) {
    console.error('[updateBookingStatusAction]', error)
    return { success: false, error: 'Error al actualizar estado' }
  }

  // ── F1.10 Policy Engine: fee de cancelación / no-show ────────────────────────
  if ((newStatus === 'cancelled' || newStatus === 'no_show') && booking.total_amount) {
    const { data: company } = await admin
      .from('companies')
      .select('settings')
      .eq('id', user.company_id)
      .single()

    const policy = parsePolicy(company?.settings)
    const fee = computeCancellationFee(
      policy,
      new Date(booking.scheduled_at),
      Number(booking.total_amount),
      { noShow: newStatus === 'no_show' },
    )

    if (fee.feeAmount > 0) {
      await admin.from('booking_fees').insert({
        booking_id: bookingId,
        company_id: user.company_id,
        type: newStatus === 'no_show' ? 'no_show_fee' : 'cancellation_fee',
        description:
          newStatus === 'no_show'
            ? `Cargo por no-show (${fee.feePct}% según política)`
            : `Cargo por cancelación tardía (${fee.feePct}% según política)`,
        amount: fee.feeAmount,
      })
    }
  }

  // F1.14 — notificar al pasajero según el nuevo estado
  const NOTIFY_BY_STATUS: Partial<Record<BookingStatus, string>> = {
    pending:   'booking_confirmation', // al confirmar una cotización (quote → pending)
    en_route:  'driver_en_route',
    arrived:   'driver_arrived',
    completed: 'trip_completed',
    cancelled: 'booking_cancelled',
  }
  const notifyType = NOTIFY_BY_STATUS[newStatus]
  if (notifyType) {
    notifyBookingEventInBackground(notifyType, toNotifyData(booking, {
      cancellation_reason: opts?.reason ?? '',
      eta_minutes: '15',
      rating_url: `${getAppUrl()}/review/${booking.id}`,
    }))
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}

// ─── Admin: Asignar conductor ─────────────────────────────────────────────────

export async function assignDriverAction(
  bookingId: string,
  driverId: string,
  vehicleId?: string,
  reassignReason?: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, driver_id, scheduled_at, duration_minutes, total_amount, booking_number, passenger_name, passenger_email, passenger_phone, pickup_location, dropoff_location, currency')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .single()

  if (!booking) return { success: false, error: 'Reservación no encontrada' }

  const assignable: BookingStatus[] = ['pending', 'assigned']
  if (!assignable.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Solo reservaciones pendientes o asignadas pueden recibir conductor' }
  }

  // Sección J — Compliance Center: la asignación manual respeta el mismo
  // bloqueo operativo que la auto-asignación, mostrando el motivo.
  const { data: driverCompliance } = await admin
    .from('drivers')
    .select('operational_block, block_reason')
    .eq('id', driverId)
    .single()
  if (driverCompliance?.operational_block) {
    return { success: false, error: `Conductor bloqueado por cumplimiento: ${driverCompliance.block_reason ?? 'ver Compliance Center'}` }
  }

  // Reasignación = ya tenía OTRO conductor asignado. Se registra en
  // booking_events y se avisa por SMS al conductor que pierde el viaje —
  // no le llega vía la app (el viaje simplemente desaparece de su lista en
  // el próximo refresh), así que necesita un aviso explícito.
  const previousDriverId = booking.driver_id
  const isReassignment = !!previousDriverId && previousDriverId !== driverId

  // Si no se especifica un vehículo a mano, se usa el que el conductor tiene
  // asignado ahora mismo (drivers.current_vehicle_id) — así la marca/placa
  // que ve el pasajero en /track siempre refleja con qué vehículo se hizo
  // el viaje, sin obligar al dispatcher a elegirlo cada vez.
  let effectiveVehicleId = vehicleId
  if (!effectiveVehicleId) {
    const { data: driverRow } = await admin
      .from('drivers')
      .select('current_vehicle_id')
      .eq('id', driverId)
      .single()
    effectiveVehicleId = driverRow?.current_vehicle_id ?? undefined
  }

  if (effectiveVehicleId) {
    const { data: vehicleCompliance } = await admin
      .from('vehicles')
      .select('operational_block, block_reason')
      .eq('id', effectiveVehicleId)
      .single()
    if (vehicleCompliance?.operational_block) {
      return { success: false, error: `Vehículo bloqueado por cumplimiento: ${vehicleCompliance.block_reason ?? 'ver Compliance Center'}` }
    }

    // Detección de conflicto de vehículo: el mismo vehículo no puede quedar
    // comprometido en dos viajes activos que se solapen en el tiempo, sin
    // importar qué conductor los maneje (ej. dos conductores de turnos
    // distintos que comparten el mismo carro, o una reasignación manual que
    // elige un vehículo ya ocupado a esa hora).
    const { data: otherVehicleBookings } = await admin
      .from('bookings')
      .select('id, booking_number, scheduled_at, duration_minutes')
      .eq('vehicle_id', effectiveVehicleId)
      .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
      .neq('id', bookingId)
    const newWindow = windowFor(booking.scheduled_at, booking.duration_minutes)
    const vehicleConflict = (otherVehicleBookings ?? []).find((b) =>
      overlaps(newWindow, windowFor(b.scheduled_at, b.duration_minutes)),
    )
    if (vehicleConflict) {
      return {
        success: false,
        error: `Vehículo ya asignado a la reserva ${vehicleConflict.booking_number} en un horario que se solapa`,
      }
    }
  }

  const updates: {
    driver_id: string
    status: BookingStatus
    dispatched_at: string
    dispatched_by: string
    vehicle_id?: string
  } = {
    driver_id:     driverId,
    status:        'assigned',
    dispatched_at: new Date().toISOString(),
    dispatched_by: user.id,
  }
  if (effectiveVehicleId) updates.vehicle_id = effectiveVehicleId

  const { error } = await admin.from('bookings').update(updates).eq('id', bookingId)
  if (error) {
    console.error('[assignDriverAction]', error)
    return { success: false, error: 'Error al asignar conductor' }
  }

  // F1.14 — notificar asignación de conductor al pasajero
  const [{ data: driverProfile }, vehicleRes] = await Promise.all([
    admin.from('user_profiles').select('first_name, last_name').eq('id', driverId).single(),
    effectiveVehicleId
      ? admin.from('vehicles').select('make, model, plate_number').eq('id', effectiveVehicleId).single()
      : Promise.resolve({ data: null }),
  ])
  const vehicle = vehicleRes.data as { make?: string; model?: string; plate_number?: string } | null

  notifyBookingEventInBackground('driver_assigned', toNotifyData(booking, {
    driver_name: driverProfile ? `${driverProfile.first_name} ${driverProfile.last_name}` : 'Tu conductor',
    vehicle_make: vehicle?.make ?? '',
    vehicle_model: vehicle?.model ?? '',
    plate_number: vehicle?.plate_number ?? '',
    tracking_url: `${getAppUrl()}/track/${booking.id}`,
  }))

  notifyDriverPushInBackground(
    driverId,
    'Nuevo viaje asignado',
    `${booking.booking_number} · ${(booking.pickup_location as { address?: string } | null)?.address ?? ''}`,
    { bookingId: booking.id, type: 'trip_assigned' },
  )

  if (isReassignment && previousDriverId) {
    await admin.from('booking_events').insert({
      booking_id: bookingId,
      company_id: user.company_id,
      type: 'driver_reassigned',
      actor: 'dispatcher',
      actor_id: user.id,
      reason: reassignReason?.trim().slice(0, 500) || null,
      metadata: { previous_driver_id: previousDriverId, new_driver_id: driverId },
    })

    const { data: prevDriver } = await admin
      .from('user_profiles')
      .select('phone')
      .eq('id', previousDriverId)
      .single()
    if (prevDriver?.phone) {
      notify({
        companyId: user.company_id,
        channel: 'sms',
        type: 'driver_unassigned',
        recipient: prevDriver.phone,
        vars: { booking_number: booking.booking_number },
        bookingId,
      }).catch((err) => console.error('[assignDriverAction] driver_unassigned notify', err))
    }
  } else {
    // Primera asignación (no reasignación) — audit trail de quién despachó.
    await admin.from('booking_events').insert({
      booking_id: bookingId,
      company_id: user.company_id,
      type: 'driver_assigned',
      actor: 'dispatcher',
      actor_id: user.id,
      metadata: { driver_id: driverId, vehicle_id: effectiveVehicleId ?? null },
    })
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath('/dispatcher/dashboard')
  return { success: true }
}

// ─── Público: Cotizaciones por tipo de vehículo ───────────────────────────────

export async function getPublicVehicleQuotesAction(
  slug: string,
  data: {
    pickupLat: number
    pickupLng: number
    pickupAddress: string
    pickupPostalCode?: string | null
    dropoffLat: number
    dropoffLng: number
    dropoffAddress: string
    dropoffPostalCode?: string | null
    scheduledAt: string
    bookingType?: BookingType
    stops?: StopInput[]
    partnerSlug?: string
  },
): Promise<{ success: boolean; error?: string; data?: VehicleQuote[] }> {
  // F1.17 — rate limit por IP (cotizaciones disparan llamadas a Google Routes)
  if (!(await checkRateLimit('public_quote', 20))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, status, currency, settings, timezone')
    .eq('slug', slug)
    .single()

  if (!company || company.status !== 'active') {
    return { success: false, error: 'Empresa no disponible' }
  }

  const companyId = company.id
  const currency  = (company.currency as string | null) ?? 'USD'
  const scheduledAt = new Date(data.scheduledAt)
  const bookingType = data.bookingType ?? 'one_way'

  // Partner Portals — si la cotizacion viene del link privado de un partner,
  // se aplica su ajuste de tarifa especial (ver lib/partners/engine.ts).
  let partnerRateAdjustmentPct = 0
  if (data.partnerSlug) {
    const { data: partner } = await admin
      .from('partners')
      .select('rate_adjustment_pct')
      .eq('company_id', companyId)
      .eq('slug', data.partnerSlug)
      .eq('is_active', true)
      .maybeSingle()
    if (partner) partnerRateAdjustmentPct = Number(partner.rate_adjustment_pct)
  }

  // F1.10 — ventana de reservación de la empresa
  const windowCheck = validateBookingTime(parseBookingWindow(company.settings), scheduledAt)
  if (!windowCheck.valid) {
    return { success: false, error: windowCheck.error }
  }
  // Sección H, item 3 — horario de operación + fechas bloqueadas
  const hoursCheck = validateOperatingHours(parseOperatingHours(company.settings), scheduledAt, company.timezone)
  if (!hoursCheck.valid) {
    return { success: false, error: hoursCheck.error }
  }

  // Tipos de vehículo activos
  const { data: vehicleTypes } = await admin
    .from('vehicle_types')
    .select('id, name, class, capacity, amenities')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('sort_order')

  if (!vehicleTypes?.length) {
    return { success: false, error: 'No hay tipos de vehículo disponibles' }
  }

  // Reglas de precio + zonas activas (para precio "Por zona")
  const [{ data: rulesRaw }, { data: zonesRaw }] = await Promise.all([
    admin
      .from('pricing_rules')
      .select('id, model, base_price, per_mile_rate, per_km_rate, hourly_rate, minimum_fare, origin_zone_id, destination_zone_id, airport_pickup_fee, airport_dropoff_fee, night_surcharge_pct, weekend_surcharge_pct, surge_enabled, surge_multiplier, vehicle_type_id, priority')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('priority', { ascending: false }),
    admin
      .from('service_zones')
      .select('id, postal_codes, center_lat, center_lng, radius_miles')
      .eq('company_id', companyId)
      .eq('is_active', true),
  ])

  const zones = (zonesRaw ?? []) as ServiceZoneForMatch[]
  const originZoneId = resolveZoneId(zones, { lat: data.pickupLat, lng: data.pickupLng, postalCode: data.pickupPostalCode })
  const destinationZoneId = resolveZoneId(zones, { lat: data.dropoffLat, lng: data.dropoffLng, postalCode: data.dropoffPostalCode })

  // Calcular ruta una sola vez (incluye paradas intermedias)
  const publicStops = sanitizeStops(data.stops)
  const route = await calculateRoute(
    data.pickupLat, data.pickupLng,
    data.dropoffLat, data.dropoffLng,
    publicStops,
  )
  const distanceMiles  = route?.distanceMi ?? 0
  const durationMinutes = route?.durationMinutes ?? 0

  const quotes: VehicleQuote[] = []

  for (const vt of vehicleTypes) {
    const rule = bestRule(rulesRaw as unknown as PricingRuleFields[], vt.id, { originZoneId, destinationZoneId })

    if (!rule) {
      quotes.push({
        vehicleType: { id: vt.id, name: vt.name, class: vt.class, capacity: vt.capacity, amenities: vt.amenities ?? [] },
        quoteId: '',
        baseAmount: 0, surchargeAmount: 0, totalAmount: 0,
        currency,
        distanceMiles: distanceMiles || null,
        durationMinutes: durationMinutes || null,
        noPrice: true,
      })
      continue
    }

    const fare = calculateFare(
      rule, distanceMiles, durationMinutes, scheduledAt, bookingType, company.timezone,
    )
    // El ajuste de tarifa del partner (si aplica) se hornea en el total
    // guardado en price_quotes — todo lo que viene despues (createPublicBookingAction)
    // simplemente lee quote.total_amount, sin tener que conocer partners.
    const totalAmount = partnerRateAdjustmentPct
      ? applyPartnerRateAdjustment(fare.totalAmount, partnerRateAdjustmentPct)
      : fare.totalAmount

    const { data: quote } = await admin
      .from('price_quotes')
      .insert({
        company_id:      companyId,
        pricing_rule_id: rule.id,
        vehicle_type_id: vt.id,
        pickup_lat:      data.pickupLat,
        pickup_lng:      data.pickupLng,
        pickup_address:  data.pickupAddress,
        dropoff_lat:     data.dropoffLat,
        dropoff_lng:     data.dropoffLng,
        dropoff_address: data.dropoffAddress,
        distance_miles:  distanceMiles || null,
        duration_minutes: durationMinutes || null,
        route_polyline:  route?.polyline ?? null,
        base_amount:     fare.baseAmount,
        surcharge_amount: fare.surchargeAmount,
        total_amount:    totalAmount,
        currency,
      })
      .select('id')
      .single()

    quotes.push({
      vehicleType: { id: vt.id, name: vt.name, class: vt.class, capacity: vt.capacity, amenities: vt.amenities ?? [] },
      quoteId:     quote?.id ?? '',
      baseAmount:  fare.baseAmount,
      surchargeAmount: fare.surchargeAmount,
      totalAmount,
      currency,
      distanceMiles:   distanceMiles || null,
      durationMinutes: durationMinutes || null,
      noPrice: false,
    })
  }

  return { success: true, data: quotes }
}

// ─── Público: reconocer pasajero recurrente por teléfono ──────────────────────
// Viajero frecuente cross-device: al escribir teléfono + nombre en el wizard,
// buscamos su última reserva CON esa empresa (guest checkout, sin cuenta) y
// ofrecemos autocompletar el resto de sus datos — con un clic explícito,
// nunca automático.
//
// Mitigación de enumeración (consulta pública sin autenticación):
// 1) Exige DOS factores, no solo el teléfono — también los primeros
//    caracteres del nombre deben coincidir (`namePrefix`). Un atacante
//    necesitaría adivinar teléfono Y nombre de la misma persona, no solo un
//    número de teléfono.
// 2) Rate limit estricto (5 intentos / 5 min por IP) — cubre con margen el
//    uso legítimo (una persona typea su teléfono+nombre una vez por
//    reserva) mientras hace impráctico probar muchos teléfonos/nombres.
export async function lookupReturningPassengerAction(
  slug: string,
  phone: string,
  namePrefix: string,
): Promise<{ found: boolean; name?: string; email?: string }> {
  const cleanPhone = (phone ?? '').trim()
  const prefix = (namePrefix ?? '').trim()
  if (cleanPhone.replace(/[^0-9]/g, '').length < 7 || prefix.length < 2) return { found: false }

  if (!(await checkRateLimit('passenger_lookup', 5, 5 * 60_000))) return { found: false }

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('id').eq('slug', slug).single()
  if (!company) return { found: false }

  // Escapa comodines de ILIKE para que el prefijo se trate como texto literal.
  const escapedPrefix = prefix.replace(/[%_\\]/g, (m) => `\\${m}`)

  const { data: booking } = await admin
    .from('bookings')
    .select('passenger_name, passenger_email')
    .eq('company_id', company.id)
    .eq('passenger_phone', cleanPhone)
    .ilike('passenger_name', `${escapedPrefix}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!booking?.passenger_name) return { found: false }
  return { found: true, name: booking.passenger_name, email: booking.passenger_email ?? undefined }
}

// ─── Público: Crear reservación (guest checkout) ──────────────────────────────

export async function createPublicBookingAction(data: {
  quoteId: string
  slug: string
  bookingType: BookingType
  passengerName: string
  passengerPhone: string
  passengerEmail?: string
  passengerCount: number
  specialInstructions?: string
  flightNumber?: string
  meetAndGreet?: boolean
  scheduledAt: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  stops?: StopInput[]
  promoCode?: string
  partnerSlug?: string
}): Promise<{ success: boolean; error?: string; data?: BookingResult }> {
  // F1.17 — rate limit por IP
  if (!(await checkRateLimit('public_booking', 5))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, status, settings, timezone, plan')
    .eq('slug', data.slug)
    .single()

  if (!company || company.status !== 'active') {
    return { success: false, error: 'Empresa no disponible' }
  }

  const limitCheck = await checkMonthlyBookingLimit(admin, company.id)
  if (!limitCheck.ok) return { success: false, error: limitCheck.error }

  // F1.10 — ventana de reservación de la empresa
  const windowCheck = validateBookingTime(
    parseBookingWindow(company.settings),
    new Date(data.scheduledAt),
  )
  if (!windowCheck.valid) {
    return { success: false, error: windowCheck.error }
  }
  // Sección H, item 3 — horario de operación + fechas bloqueadas
  const hoursCheck = validateOperatingHours(parseOperatingHours(company.settings), new Date(data.scheduledAt), company.timezone)
  if (!hoursCheck.valid) {
    return { success: false, error: hoursCheck.error }
  }

  // Validar cotización — montos SIEMPRE del server
  const { data: quote } = await admin
    .from('price_quotes')
    .select('*')
    .eq('id', data.quoteId)
    .eq('company_id', company.id)
    .eq('is_used', false)
    .single()

  if (!quote) return { success: false, error: 'Cotización no válida o ya utilizada' }
  if (new Date(quote.expires_at) < new Date()) {
    return { success: false, error: 'La cotización expiró. Regresa al paso 1 para recalcular.' }
  }

  // Validar campos obligatorios + límites de tamaño (F1.17)
  const name  = data.passengerName?.trim().slice(0, 120)
  const phone = data.passengerPhone?.trim().slice(0, 30)
  const email = data.passengerEmail?.trim().slice(0, 254)
  if (!name)  return { success: false, error: 'Nombre del pasajero requerido' }
  if (!phone) return { success: false, error: 'Teléfono requerido' }
  if (!/^[+\d][\d\s().-]{6,}$/.test(phone)) {
    return { success: false, error: 'Teléfono inválido' }
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Email inválido' }
  }
  const passengerCount = Math.min(50, Math.max(1, Math.floor(data.passengerCount) || 1))

  // Código promocional — SIEMPRE revalidado server-side (nunca se confía en
  // el descuento que haya mostrado el wizard). Si el código dejó de ser
  // válido entre la vista previa y este submit (se agotó, expiró, etc.), la
  // reserva se rechaza en vez de cobrar de más silenciosamente.
  let promoCodeId: string | null = null
  let promoUsesCount = 0
  let discountAmount = 0
  if (data.promoCode?.trim()) {
    const { data: addon } = await admin
      .from('company_addons')
      .select('enabled')
      .eq('company_id', company.id)
      .eq('addon_key', 'promo_codes')
      .maybeSingle()

    if (!isAddonActive(company.plan, addon?.enabled ?? false)) {
      return { success: false, error: 'Los códigos promocionales no están disponibles para este operador' }
    }

    const code = data.promoCode.trim().toUpperCase()
    const { data: promo } = await admin
      .from('promo_codes')
      .select('*')
      .eq('company_id', company.id)
      .eq('code', code)
      .maybeSingle()
    if (!promo) return { success: false, error: 'Código promocional no válido' }

    const { count: customerRedemptionsCount } = await admin
      .from('promo_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('promo_code_id', promo.id)
      .eq('customer_phone', phone)

    const validation = validatePromoCode(
      {
        discountType: promo.discount_type as 'percentage' | 'fixed',
        discountValue: Number(promo.discount_value),
        maxUses: promo.max_uses,
        usesCount: promo.uses_count,
        maxUsesPerCustomer: promo.max_uses_per_customer,
        validFrom: promo.valid_from,
        validUntil: promo.valid_until,
        minBookingAmount: promo.min_booking_amount,
        isActive: promo.is_active,
      },
      { bookingAmount: quote.total_amount, customerRedemptionsCount: customerRedemptionsCount ?? 0 },
    )
    if (!validation.valid) return { success: false, error: 'El código promocional ya no es válido' }

    promoCodeId = promo.id
    promoUsesCount = promo.uses_count
    discountAmount = computeDiscount(
      { discountType: promo.discount_type as 'percentage' | 'fixed', discountValue: Number(promo.discount_value) },
      quote.total_amount,
    )
  }

  // Partner Portals — si la reserva viene del link privado de un partner, se
  // valida que le pertenezca a ESTA empresa y este activo (nunca se confia en
  // un slug arbitrario del cliente) antes de etiquetar la reserva.
  let partnerId: string | null = null
  if (data.partnerSlug) {
    const { data: partner } = await admin
      .from('partners')
      .select('id')
      .eq('company_id', company.id)
      .eq('slug', data.partnerSlug)
      .eq('is_active', true)
      .maybeSingle()
    partnerId = partner?.id ?? null
  }

  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      company_id:       company.id,
      status:           'pending',
      type:             data.bookingType,
      vehicle_type_id:  quote.vehicle_type_id,
      partner_id:       partnerId,
      passenger_count:  passengerCount,
      passenger_name:   name,
      passenger_phone:  phone,
      passenger_email:  email || null,
      pickup_location:  { address: data.pickupAddress.slice(0, 500),  lat: data.pickupLat,  lng: data.pickupLng  },
      dropoff_location: { address: data.dropoffAddress.slice(0, 500), lat: data.dropoffLat, lng: data.dropoffLng },
      waypoints:        sanitizeStops(data.stops) as unknown as Json[],
      scheduled_at:     data.scheduledAt,
      flight_number:    data.flightNumber?.trim().slice(0, 20) || null,
      special_instructions: data.specialInstructions?.trim().slice(0, 1000) || null,
      meet_and_greet:   Boolean(data.meetAndGreet),
      price_quote_id:   data.quoteId,
      base_amount:      quote.base_amount,
      total_amount:     quote.total_amount - discountAmount,
      currency:         quote.currency ?? 'USD',
      distance_miles:   quote.distance_miles,
      duration_minutes: quote.duration_minutes,
      route_polyline:   quote.route_polyline,
      promo_code_id:        promoCodeId,
      promo_discount_amount: promoCodeId ? discountAmount : null,
    })
    .select('id, booking_number')
    .single()

  if (error || !booking) {
    console.error('[createPublicBookingAction]', error)
    return { success: false, error: 'Error al crear reservación. Intenta de nuevo.' }
  }

  await admin.from('price_quotes').update({ is_used: true }).eq('id', data.quoteId)

  if (promoCodeId) {
    await admin.from('promo_code_redemptions').insert({
      promo_code_id: promoCodeId,
      booking_id: booking.id,
      customer_phone: phone,
      customer_email: email || null,
      discount_amount: discountAmount,
    })
    // Incremento no atómico (lee-y-escribe) — el volumen de canjes
    // simultáneos del MISMO código es bajo; mismo criterio que otros
    // contadores no críticos de este proyecto (ej. drivers.total_trips). Un
    // pequeño over-run de maxUses en una carrera muy rara no es grave.
    await admin.from('promo_codes').update({ uses_count: promoUsesCount + 1 }).eq('id', promoCodeId)
  }

  const fees: { booking_id: string; company_id: string; type: string; description: string; amount: number }[] = []
  if (quote.base_amount > 0) {
    fees.push({ booking_id: booking.id, company_id: company.id, type: 'base', description: 'Tarifa base', amount: quote.base_amount })
  }
  if (quote.surcharge_amount && quote.surcharge_amount > 0) {
    fees.push({ booking_id: booking.id, company_id: company.id, type: 'surcharge', description: 'Recargo', amount: quote.surcharge_amount })
  }
  if (fees.length > 0) await admin.from('booking_fees').insert(fees)

  // Auto-asignación a un conductor en servicio (best-effort)
  try {
    const autoAssignBooking = {
      id: booking.id,
      company_id: company.id,
      booking_number: booking.booking_number,
      scheduled_at: data.scheduledAt,
      duration_minutes: quote.duration_minutes,
      passenger_name: name,
      passenger_email: email || null,
      passenger_phone: phone,
      pickup_location: { address: data.pickupAddress },
      dropoff_location: { address: data.dropoffAddress },
      total_amount: quote.total_amount,
      currency: quote.currency ?? 'USD',
    }
    const result = await tryAutoAssignDriver(admin, autoAssignBooking)
    if (!result.assigned) await tryAutoFarmToAffiliates(admin, autoAssignBooking)
  } catch (e) {
    console.error('[createPublicBookingAction] auto-assign', e)
  }

  // Flight tracking — consulta el vuelo en background si aplica
  const publicFlightNumber = data.flightNumber?.trim()
  if (publicFlightNumber && ['airport_pickup', 'airport_dropoff'].includes(data.bookingType)) {
    waitUntil(trackBookingFlight(company.id, booking.id, publicFlightNumber))
  }

  // F1.14 — confirmación al pasajero (email + SMS)
  notifyBookingEventInBackground('booking_confirmation', toNotifyData({
    id: booking.id,
    company_id: company.id,
    booking_number: booking.booking_number,
    passenger_name: name,
    passenger_email: email || null,
    passenger_phone: phone,
    scheduled_at: data.scheduledAt,
    pickup_location: { address: data.pickupAddress },
    dropoff_location: { address: data.dropoffAddress },
    total_amount: quote.total_amount,
    currency: quote.currency,
  }))

  return {
    success: true,
    data: { bookingId: booking.id, bookingNumber: booking.booking_number },
  }
}
