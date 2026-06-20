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
  computeCancellationFee,
  validateBookingTime,
} from '@/lib/policy/engine'
import { waitUntil } from '@vercel/functions'
import { notifyBookingEventInBackground } from '@/lib/notifications'
import { trackBookingFlight } from '@/lib/flights/refresh'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'
import { getAppUrl } from '@/lib/app-url'
import { calculateFare, bestRule, type PricingRuleFields } from '@/lib/pricing/engine'
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
  const dropoffLat   = parseFloat(formData.get('dropoff_lat') as string)
  const dropoffLng   = parseFloat(formData.get('dropoff_lng') as string)
  const dropoffAddr  = (formData.get('dropoff') as string) ?? ''
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

  // Obtener reglas de precio
  const { data: rulesRaw } = await admin
    .from('pricing_rules')
    .select('id, model, base_price, per_mile_rate, per_km_rate, hourly_rate, minimum_fare, airport_pickup_fee, airport_dropoff_fee, night_surcharge_pct, weekend_surcharge_pct, surge_enabled, surge_multiplier, vehicle_type_id, priority')
    .eq('company_id', user.company_id)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (!rulesRaw?.length) {
    return { success: false, error: 'No hay reglas de precio activas. Configura precios en /admin/pricing.' }
  }

  const rule = bestRule(rulesRaw as unknown as PricingRuleFields[], vehicleTypeId)
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
  const corporateAccountId = (formData.get('corporate_account_id') as string)?.trim() || null

  if (!passengerName) return { success: false, error: 'Nombre del pasajero requerido' }
  if (!scheduledAt)   return { success: false, error: 'Fecha y hora requeridas' }
  if (!pickupAddr)    return { success: false, error: 'Dirección de pickup requerida' }
  if (!dropoffAddr)   return { success: false, error: 'Dirección de dropoff requerida' }

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
      status:           'pending',
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
      price_quote_id:   quoteId,
      // Montos SIEMPRE del quote (server-calculated) — nunca del form
      base_amount:      quote.base_amount,
      total_amount:     quote.total_amount,
      currency:         quote.currency ?? 'USD',
      distance_miles:   quote.distance_miles,
      duration_minutes: quote.duration_minutes,
    })
    .select('id, booking_number')
    .single()

  if (error || !booking) {
    console.error('[createBookingAction]', error)
    return { success: false, error: 'Error al crear reservación' }
  }

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

  // Flight tracking — consulta el vuelo en background si aplica
  if (flightNumber && ['airport_pickup', 'airport_dropoff'].includes(bookingType)) {
    waitUntil(trackBookingFlight(booking.id, flightNumber))
  }

  // F1.14 — confirmación al pasajero (email + SMS)
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

  revalidatePath('/admin/bookings')
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

  const assignable: BookingStatus[] = ['pending', 'assigned']
  if (!assignable.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Solo reservaciones pendientes o asignadas pueden recibir conductor' }
  }

  const updates: {
    driver_id: string
    status: BookingStatus
    dispatched_at: string
    vehicle_id?: string
  } = {
    driver_id:     driverId,
    status:        'assigned',
    dispatched_at: new Date().toISOString(),
  }
  if (vehicleId) updates.vehicle_id = vehicleId

  const { error } = await admin.from('bookings').update(updates).eq('id', bookingId)
  if (error) {
    console.error('[assignDriverAction]', error)
    return { success: false, error: 'Error al asignar conductor' }
  }

  // F1.14 — notificar asignación de conductor al pasajero
  const [{ data: driverProfile }, vehicleRes] = await Promise.all([
    admin.from('user_profiles').select('first_name, last_name').eq('id', driverId).single(),
    vehicleId
      ? admin.from('vehicles').select('make, model, plate_number').eq('id', vehicleId).single()
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

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${bookingId}`)
  return { success: true }
}

// ─── Público: Cotizaciones por tipo de vehículo ───────────────────────────────

export async function getPublicVehicleQuotesAction(
  slug: string,
  data: {
    pickupLat: number
    pickupLng: number
    pickupAddress: string
    dropoffLat: number
    dropoffLng: number
    dropoffAddress: string
    scheduledAt: string
    bookingType?: BookingType
    stops?: StopInput[]
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

  // F1.10 — ventana de reservación de la empresa
  const windowCheck = validateBookingTime(parseBookingWindow(company.settings), scheduledAt)
  if (!windowCheck.valid) {
    return { success: false, error: windowCheck.error }
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

  // Reglas de precio
  const { data: rulesRaw } = await admin
    .from('pricing_rules')
    .select('id, model, base_price, per_mile_rate, per_km_rate, hourly_rate, minimum_fare, airport_pickup_fee, airport_dropoff_fee, night_surcharge_pct, weekend_surcharge_pct, surge_enabled, surge_multiplier, vehicle_type_id, priority')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

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
    const rule = bestRule(rulesRaw as unknown as PricingRuleFields[], vt.id)

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
        base_amount:     fare.baseAmount,
        surcharge_amount: fare.surchargeAmount,
        total_amount:    fare.totalAmount,
        currency,
      })
      .select('id')
      .single()

    quotes.push({
      vehicleType: { id: vt.id, name: vt.name, class: vt.class, capacity: vt.capacity, amenities: vt.amenities ?? [] },
      quoteId:     quote?.id ?? '',
      baseAmount:  fare.baseAmount,
      surchargeAmount: fare.surchargeAmount,
      totalAmount: fare.totalAmount,
      currency,
      distanceMiles:   distanceMiles || null,
      durationMinutes: durationMinutes || null,
      noPrice: false,
    })
  }

  return { success: true, data: quotes }
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
  scheduledAt: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  stops?: StopInput[]
}): Promise<{ success: boolean; error?: string; data?: BookingResult }> {
  // F1.17 — rate limit por IP
  if (!(await checkRateLimit('public_booking', 5))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, status, settings')
    .eq('slug', data.slug)
    .single()

  if (!company || company.status !== 'active') {
    return { success: false, error: 'Empresa no disponible' }
  }

  // F1.10 — ventana de reservación de la empresa
  const windowCheck = validateBookingTime(
    parseBookingWindow(company.settings),
    new Date(data.scheduledAt),
  )
  if (!windowCheck.valid) {
    return { success: false, error: windowCheck.error }
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

  const { data: booking, error } = await admin
    .from('bookings')
    .insert({
      company_id:       company.id,
      status:           'pending',
      type:             data.bookingType,
      vehicle_type_id:  quote.vehicle_type_id,
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
      price_quote_id:   data.quoteId,
      base_amount:      quote.base_amount,
      total_amount:     quote.total_amount,
      currency:         quote.currency ?? 'USD',
      distance_miles:   quote.distance_miles,
      duration_minutes: quote.duration_minutes,
    })
    .select('id, booking_number')
    .single()

  if (error || !booking) {
    console.error('[createPublicBookingAction]', error)
    return { success: false, error: 'Error al crear reservación. Intenta de nuevo.' }
  }

  await admin.from('price_quotes').update({ is_used: true }).eq('id', data.quoteId)

  const fees: { booking_id: string; company_id: string; type: string; description: string; amount: number }[] = []
  if (quote.base_amount > 0) {
    fees.push({ booking_id: booking.id, company_id: company.id, type: 'base', description: 'Tarifa base', amount: quote.base_amount })
  }
  if (quote.surcharge_amount && quote.surcharge_amount > 0) {
    fees.push({ booking_id: booking.id, company_id: company.id, type: 'surcharge', description: 'Recargo', amount: quote.surcharge_amount })
  }
  if (fees.length > 0) await admin.from('booking_fees').insert(fees)

  // Flight tracking — consulta el vuelo en background si aplica
  const publicFlightNumber = data.flightNumber?.trim()
  if (publicFlightNumber && ['airport_pickup', 'airport_dropoff'].includes(data.bookingType)) {
    waitUntil(trackBookingFlight(booking.id, publicFlightNumber))
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
