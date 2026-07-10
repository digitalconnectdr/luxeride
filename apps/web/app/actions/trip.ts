'use server'
// ── Acciones del viaje: cancelación del cliente, reporte y chat ────────────────
// El pasajero NO tiene login: el UUID de la reserva en el link de seguimiento
// actúa como capability URL. Toda acción pública valida el UUID y opera con
// service-role. El conductor sí está autenticado (requireRole('driver')).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { SessionUser } from '@/lib/auth/session'
import { parsePolicy, computeCancellationFee, parseExtraFees } from '@/lib/policy/engine'
import { calculateFare, bestRule, type PricingRuleFields } from '@/lib/pricing/engine'
import { calculateRoute } from '@/lib/maps/routes'
import { getStripe } from '@/lib/stripe/server'
import { createWhopCheckout } from '@/lib/whop/checkout'
import { getAppUrl } from '@/lib/app-url'
import type { BookingStatus, BookingType, Json } from '@/lib/supabase/database.types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Estados en los que el cliente todavía puede cancelar (antes de iniciar el viaje)
const CLIENT_CANCELLABLE: BookingStatus[] = ['pending', 'assigned', 'en_route', 'arrived']
// Estados en los que el cliente puede pedir una parada extra (viaje en curso)
const STOP_ALLOWED: BookingStatus[] = ['assigned', 'en_route', 'arrived', 'in_progress']
// Estados terminales donde el chat ya no aplica
const CHAT_CLOSED: BookingStatus[] = ['completed', 'cancelled', 'no_show', 'failed']

export interface TripMessage {
  id: string
  sender: 'client' | 'driver'
  body: string
  createdAt: string
  readAt: string | null
}

// ─── Cancelación por el cliente ───────────────────────────────────────────────

export interface CancellationPreview {
  free: boolean
  feePct: number
  feeAmount: number
  currency: string
}

// Vista previa del cargo de cancelación (según la política de la empresa), para
// mostrarla al pasajero ANTES de que confirme.
export async function getCancellationPreviewAction(
  bookingId: string,
): Promise<{ success: boolean; preview?: CancellationPreview; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, scheduled_at, total_amount, currency')
    .eq('id', bookingId)
    .single()
  if (!booking) return { success: false, error: 'Reserva no encontrada' }

  const { data: company } = await admin
    .from('companies')
    .select('settings')
    .eq('id', booking.company_id)
    .single()

  const policy = parsePolicy(company?.settings)
  const fee = computeCancellationFee(
    policy,
    new Date(booking.scheduled_at),
    Number(booking.total_amount ?? 0),
  )

  return {
    success: true,
    preview: {
      free: fee.feeAmount <= 0,
      feePct: fee.feePct,
      feeAmount: fee.feeAmount,
      currency: booking.currency ?? 'USD',
    },
  }
}

export async function cancelTripByClientAction(
  bookingId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, driver_id, scheduled_at, total_amount')
    .eq('id', bookingId)
    .single()

  if (!booking) return { success: false, error: 'Reserva no encontrada' }

  if (!CLIENT_CANCELLABLE.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Este viaje ya no se puede cancelar. Contacta al operador.' }
  }

  const cleanReason = (reason ?? '').trim().slice(0, 500)
  const { error } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cleanReason ? `Cliente: ${cleanReason}` : 'Cancelado por el cliente',
    })
    .eq('id', bookingId)

  if (error) {
    console.error('[cancelTripByClientAction]', error)
    return { success: false, error: 'No se pudo cancelar. Intenta de nuevo.' }
  }

  // Distingue "canceló antes de tener conductor" (rutinario) de "rechazó el
  // servicio ya asignado" (señal a vigilar — repetido con un conductor
  // específico puede indicar un problema real).
  if (booking.driver_id) {
    await admin.from('booking_events').insert({
      booking_id: bookingId,
      company_id: booking.company_id,
      type: 'customer_rejected',
      actor: 'customer',
      reason: cleanReason || null,
      metadata: { driver_id: booking.driver_id },
    })
  }

  // ── Política de cancelación: registrar el cargo si aplica (mismo motor que admin)
  if (booking.total_amount) {
    const { data: company } = await admin
      .from('companies')
      .select('settings')
      .eq('id', booking.company_id)
      .single()
    const policy = parsePolicy(company?.settings)
    const fee = computeCancellationFee(
      policy,
      new Date(booking.scheduled_at),
      Number(booking.total_amount),
    )
    if (fee.feeAmount > 0) {
      await admin.from('booking_fees').insert({
        booking_id: bookingId,
        company_id: booking.company_id,
        type: 'cancellation_fee',
        description: `Cargo por cancelación del cliente (${fee.feePct}% según política)`,
        amount: fee.feeAmount,
      })
    }
  }

  revalidatePath(`/track/${bookingId}`)
  return { success: true }
}

// ─── Parada adicional durante el viaje (con re-cotización) ────────────────────

export interface StopInput {
  address: string
  lat?: number
  lng?: number
}

type LatLng = { address?: string; lat?: number; lng?: number }

// Recalcula la ruta con la parada nueva y devuelve el costo extra vs el total
// actual. Si no hay coordenadas (parada ni ruta georreferenciada), extra = null
// (el operador ajustará el costo manualmente).
async function recomputeWithStop(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
  stop: StopInput,
) {
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, driver_id, vehicle_type_id, type, scheduled_at, total_amount, currency, pickup_location, dropoff_location, waypoints, booking_number, passenger_name, passenger_email')
    .eq('id', bookingId)
    .single()
  if (!booking) {
    return {
      booking: null, extra: null as number | null, newTotal: null as number | null,
      distanceMi: null as number | null, durationMin: null as number | null,
      routePolyline: null as string | null,
    }
  }

  const pickup = booking.pickup_location as LatLng | null
  const dropoff = booking.dropoff_location as LatLng | null
  const existing = (Array.isArray(booking.waypoints) ? booking.waypoints : []) as LatLng[]

  const haveCoords =
    typeof stop.lat === 'number' && typeof stop.lng === 'number' &&
    typeof pickup?.lat === 'number' && typeof pickup?.lng === 'number' &&
    typeof dropoff?.lat === 'number' && typeof dropoff?.lng === 'number'

  let extra: number | null = null
  let newTotal: number | null = null
  let distanceMi: number | null = null
  let durationMin: number | null = null
  let routePolyline: string | null = null

  if (haveCoords) {
    const stops = [
      ...existing
        .filter((w) => typeof w.lat === 'number' && typeof w.lng === 'number')
        .map((w) => ({ address: w.address ?? '', lat: w.lat!, lng: w.lng! })),
      { address: stop.address, lat: stop.lat!, lng: stop.lng! },
    ]
    const route = await calculateRoute(pickup!.lat!, pickup!.lng!, dropoff!.lat!, dropoff!.lng!, stops)
    if (route) {
      distanceMi = route.distanceMi
      durationMin = route.durationMinutes
      routePolyline = route.polyline
      const { data: company } = await admin
        .from('companies')
        .select('timezone')
        .eq('id', booking.company_id)
        .single()
      const { data: rulesRaw } = await admin
        .from('pricing_rules')
        .select('id, model, base_price, per_mile_rate, per_km_rate, hourly_rate, minimum_fare, airport_pickup_fee, airport_dropoff_fee, night_surcharge_pct, weekend_surcharge_pct, surge_enabled, surge_multiplier, vehicle_type_id, priority')
        .eq('company_id', booking.company_id)
        .eq('is_active', true)
        .order('priority', { ascending: false })
      const rule = bestRule((rulesRaw ?? []) as unknown as PricingRuleFields[], booking.vehicle_type_id)
      if (rule) {
        const fare = calculateFare(
          rule, distanceMi, durationMin,
          new Date(booking.scheduled_at), booking.type as BookingType, company?.timezone,
        )
        newTotal = fare.totalAmount
        extra = Math.max(0, Math.round((newTotal - Number(booking.total_amount ?? 0)) * 100) / 100)
      }
    }
  }

  return { booking, extra, newTotal, distanceMi, durationMin, routePolyline }
}

export interface StopQuote {
  extraAmount: number | null  // null = costo a confirmar por el operador
  currency: string
  free: boolean
}

// Vista previa del costo de agregar la parada (antes de confirmar).
export async function quoteTripStopAction(
  bookingId: string,
  stop: StopInput,
): Promise<{ success: boolean; quote?: StopQuote; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  if (!(stop?.address ?? '').trim()) return { success: false, error: 'Escribe la dirección de la parada' }

  const admin = createAdminClient()
  const res = await recomputeWithStop(admin, bookingId, stop)
  if (!res.booking) return { success: false, error: 'Reserva no encontrada' }
  if (!STOP_ALLOWED.includes(res.booking.status as BookingStatus)) {
    return { success: false, error: 'Ya no es posible agregar paradas a este viaje.' }
  }
  return {
    success: true,
    quote: {
      extraAmount: res.extra,
      currency: res.booking.currency ?? 'USD',
      free: res.extra === 0,
    },
  }
}

// Núcleo compartido: aplica la parada (waypoint + total + fee + aviso por chat).
// El costo extra ya viene recalculado en `res` para CUALQUIER modelo de precio
// (flat_rate, per_mile, per_km, hourly, zone_based) porque usa calculateFare.
async function applyStopToBooking(
  admin: ReturnType<typeof createAdminClient>,
  res: Awaited<ReturnType<typeof recomputeWithStop>>,
  stop: StopInput,
  sender: 'client' | 'driver',
): Promise<{ extra: number | null; currency: string }> {
  const booking = res.booking!
  const address = stop.address.trim().slice(0, 300)
  const existing = Array.isArray(booking.waypoints) ? booking.waypoints : []
  const newStop = {
    address,
    ...(typeof stop.lat === 'number' ? { lat: stop.lat } : {}),
    ...(typeof stop.lng === 'number' ? { lng: stop.lng } : {}),
    [sender === 'driver' ? 'added_by_driver' : 'added_by_client']: true,
  } as unknown as Json

  const updates: {
    waypoints: Json[]
    total_amount?: number
    distance_miles?: number
    duration_minutes?: number
    route_polyline?: string | null
  } = { waypoints: [...existing, newStop] as Json[] }
  // El trazado del mapa se actualiza siempre que se recalculó ruta (aunque la
  // parada resulte gratis) — el mapa debe reflejar la ruta real, no solo el
  // precio.
  if (res.routePolyline !== undefined) updates.route_polyline = res.routePolyline
  const extra = res.extra
  if (extra != null && extra > 0 && res.newTotal != null) {
    updates.total_amount = res.newTotal
    if (res.distanceMi != null) updates.distance_miles = res.distanceMi
    if (res.durationMin != null) updates.duration_minutes = res.durationMin
  }
  await admin.from('bookings').update(updates).eq('id', booking.id)

  if (extra != null && extra > 0) {
    await admin.from('booking_fees').insert({
      booking_id: booking.id,
      company_id: booking.company_id,
      type: 'route_change_fee',
      description: `Parada adicional (${address.slice(0, 120)})`,
      amount: extra,
    })
  }

  const currency = booking.currency ?? 'USD'
  const costNote =
    extra == null ? ' (el operador confirmará si tiene costo)'
    : extra > 0 ? ` (+${extra.toFixed(2)} ${currency})`
    : ' (sin costo adicional)'
  await admin.from('trip_messages').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    sender,
    body: `📍 Parada adicional: ${address}${costNote}`,
  })

  return { extra, currency }
}

// El pasajero agrega una parada desde el link de seguimiento.
export async function addTripStopAction(
  bookingId: string,
  stop: StopInput,
): Promise<{ success: boolean; error?: string; extraAmount?: number | null; currency?: string; paymentUrl?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  if ((stop?.address ?? '').trim().length < 3) return { success: false, error: 'Escribe la dirección de la parada' }
  // Sin coordenadas no se puede recalcular la ruta ni el precio — la parada
  // quedaría "a confirmar" sin ningún flujo de cobro posterior. Se exige
  // seleccionar una sugerencia del autocomplete (la UI ya lo bloquea).
  if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') {
    return { success: false, error: 'Selecciona la dirección desde las sugerencias para calcular el costo.' }
  }

  const admin = createAdminClient()
  const res = await recomputeWithStop(admin, bookingId, stop)
  const booking = res.booking
  if (!booking) return { success: false, error: 'Reserva no encontrada' }
  if (!STOP_ALLOWED.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Ya no es posible agregar paradas a este viaje.' }
  }

  const { extra, currency } = await applyStopToBooking(admin, res, stop, 'client')

  // Si hay costo y el viaje ya se pagó online, generar el cobro de la diferencia
  let paymentUrl: string | undefined
  if (extra != null && extra > 0) {
    paymentUrl = await createStopChargeIfPaidOnline(admin, booking, extra)
  }

  revalidatePath(`/track/${bookingId}`)
  return { success: true, extraAmount: extra, currency, paymentUrl }
}

// El conductor agrega una parada desde su panel (solo en sus viajes).
export async function driverAddTripStopAction(
  bookingId: string,
  stop: StopInput,
): Promise<{ success: boolean; error?: string; extraAmount?: number | null; currency?: string }> {
  if ((stop?.address ?? '').trim().length < 3) return { success: false, error: 'Escribe la dirección de la parada' }
  if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') {
    return { success: false, error: 'Selecciona la dirección desde las sugerencias para calcular el costo.' }
  }

  const user = await requireRole('driver')
  const admin = createAdminClient()
  const res = await recomputeWithStop(admin, bookingId, stop)
  const booking = res.booking
  if (!booking || booking.driver_id !== user.id) {
    return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  }
  if (!STOP_ALLOWED.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Ya no es posible agregar paradas a este viaje.' }
  }

  const { extra, currency } = await applyStopToBooking(admin, res, stop, 'driver')

  revalidatePath('/driver/trips')
  return { success: true, extraAmount: extra, currency }
}

// ─── Cargos extra del conductor (pasajero/equipaje adicional) ─────────────────

export type ExtraChargeType = 'extra_passenger' | 'extra_luggage'

// El conductor agrega un cargo por pasajero o equipaje extra durante el viaje
// (ej.: reservaron para 3 personas y llegaron 4). El monto unitario lo define
// el operador en Configuración (settings.fees); si está en 0 el cargo está
// desactivado. Se registra en booking_fees, suma al total y avisa por chat.
export async function driverAddExtraChargeAction(
  bookingId: string,
  type: ExtraChargeType,
  qty: number,
): Promise<{ success: boolean; error?: string; amount?: number; currency?: string }> {
  const user = await requireRole('driver')
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  if (type !== 'extra_passenger' && type !== 'extra_luggage') {
    return { success: false, error: 'Tipo de cargo inválido' }
  }
  const quantity = Math.min(10, Math.max(1, Math.round(qty)))

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, company_id, driver_id, status, total_amount, currency, booking_number')
    .eq('id', bookingId)
    .single()
  if (!booking || booking.driver_id !== user.id) {
    return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  }
  if (!STOP_ALLOWED.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Ya no es posible agregar cargos a este viaje.' }
  }

  const { data: company } = await admin
    .from('companies')
    .select('settings')
    .eq('id', booking.company_id)
    .single()
  const fees = parseExtraFees(company?.settings)
  const unit = type === 'extra_passenger' ? fees.extra_passenger_fee : fees.extra_luggage_fee
  if (unit <= 0) {
    return { success: false, error: 'El operador no tiene configurado este cargo.' }
  }

  const amount = Math.round(unit * quantity * 100) / 100
  const newTotal = Math.round((Number(booking.total_amount ?? 0) + amount) * 100) / 100

  const label = type === 'extra_passenger' ? 'Pasajero extra' : 'Equipaje extra'
  const { error: feeErr } = await admin.from('booking_fees').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    type: type === 'extra_passenger' ? 'extra_passenger_fee' : 'extra_luggage_fee',
    description: `${label} × ${quantity}`,
    amount,
  })
  if (feeErr) {
    console.error('[driverAddExtraChargeAction]', feeErr)
    return { success: false, error: 'No se pudo registrar el cargo. Intenta de nuevo.' }
  }

  await admin.from('bookings').update({ total_amount: newTotal }).eq('id', booking.id)

  const currency = booking.currency ?? 'USD'
  const icon = type === 'extra_passenger' ? '👤' : '🧳'
  await admin.from('trip_messages').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    sender: 'driver',
    body: `${icon} ${label} × ${quantity}: +${amount.toFixed(2)} ${currency}`,
  })

  revalidatePath('/driver/trips')
  return { success: true, amount, currency }
}

// Crea un Stripe Checkout SOLO por la diferencia, si el viaje ya tenía un pago
// online exitoso y la empresa tiene Connect activo. Si no aplica, devuelve null
// (el extra queda sumado al total y se cobra al conductor / lo gestiona el operador).
async function createStopChargeIfPaidOnline(
  admin: ReturnType<typeof createAdminClient>,
  booking: { id: string; company_id: string; booking_number: string; currency: string | null; passenger_email: string | null; passenger_name: string | null },
  extra: number,
): Promise<string | undefined> {
  // ¿Hubo un pago con tarjeta exitoso? (si pagó en efectivo, no aplica link)
  const { data: paid } = await admin
    .from('payments')
    .select('id')
    .eq('booking_id', booking.id)
    .eq('payment_method', 'card')
    .in('status', ['succeeded', 'processing'])
    .limit(1)
  if (!paid?.length) return undefined

  const { data: company } = await admin
    .from('companies')
    .select(
      'stripe_connect_account_id, stripe_connect_onboarded, settings, whop_connect_company_id, whop_connect_onboarded, active_payment_provider',
    )
    .eq('id', booking.company_id)
    .single()

  const useConnect = Boolean(company?.stripe_connect_account_id && company?.stripe_connect_onboarded)
  const useWhop = Boolean(
    company?.active_payment_provider === 'whop' &&
      company?.whop_connect_company_id &&
      company?.whop_connect_onboarded,
  )
  if (!useConnect && !useWhop) return undefined

  const currency = (booking.currency ?? 'USD').toLowerCase()
  const cents = Math.round(extra * 100)
  const feePctRaw = (company?.settings as { payments?: { platform_fee_pct?: number } } | null)?.payments?.platform_fee_pct
  const feePct = typeof feePctRaw === 'number' && feePctRaw >= 0 && feePctRaw <= 50 ? feePctRaw : 0
  const feeCents = Math.round(cents * (feePct / 100))

  const { data: payment } = await admin
    .from('payments')
    .insert({
      company_id: booking.company_id,
      booking_id: booking.id,
      amount: cents / 100,
      currency: currency.toUpperCase(),
      platform_fee: feeCents / 100,
      net_amount: (cents - feeCents) / 100,
      status: 'pending',
      payment_method: 'card',
      description: `Parada adicional — Booking ${booking.booking_number}`,
      stripe_connect_account_id: useConnect ? company!.stripe_connect_account_id : null,
    })
    .select('id')
    .single()
  if (!payment) return undefined

  if (useWhop) {
    const result = await createWhopCheckout({
      whopConnectCompanyId: company!.whop_connect_company_id!,
      amountCents: cents,
      feeCents,
      currency,
      title: `Parada adicional — Reservación ${booking.booking_number}`,
      productExternalId: `luxeride-booking-${booking.company_id}`,
      productTitle: 'Reservaciones LuxeRide',
      redirectUrl: `${getAppUrl()}/payment/success?booking=${encodeURIComponent(booking.booking_number)}`,
      metadata: { payment_id: payment.id, booking_id: booking.id, company_id: booking.company_id, kind: 'route_change' },
    })

    if (!result.ok) {
      await admin.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
      return undefined
    }

    await admin.from('payments').update({ whop_checkout_id: result.checkoutConfigurationId }).eq('id', payment.id)
    return result.url
  }

  const stripe = getStripe()
  if (!stripe) {
    await admin.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
    return undefined
  }

  try {
    const appUrl = getAppUrl()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: booking.passenger_email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: cents,
          product_data: { name: `Parada adicional — Reservación ${booking.booking_number}` },
        },
      }],
      payment_intent_data: {
        transfer_data: { destination: company!.stripe_connect_account_id! },
        application_fee_amount: feeCents > 0 ? feeCents : undefined,
        metadata: { payment_id: payment.id, booking_id: booking.id, kind: 'route_change' },
      },
      metadata: { payment_id: payment.id, booking_id: booking.id, company_id: booking.company_id, kind: 'route_change' },
      success_url: `${appUrl}/payment/success?booking=${encodeURIComponent(booking.booking_number)}`,
      cancel_url: `${appUrl}/track/${booking.id}`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    })
    await admin.from('payments').update({ metadata: { checkout_session_id: session.id } }).eq('id', payment.id)
    return session.url ?? undefined
  } catch (err) {
    console.error('[createStopChargeIfPaidOnline]', err)
    await admin.from('payments').update({ status: 'cancelled' }).eq('id', payment.id)
    return undefined
  }
}

// ─── Reporte del conductor ────────────────────────────────────────────────────

export async function reportDriverAction(
  bookingId: string,
  category: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  const cleanReason = (reason ?? '').trim()
  if (cleanReason.length < 3) return { success: false, error: 'Describe brevemente el problema.' }

  const allowedCats = ['false_arrival', 'no_contact', 'unsafe', 'other']
  const cat = allowedCats.includes(category) ? category : 'other'

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, company_id, driver_id')
    .eq('id', bookingId)
    .single()

  if (!booking) return { success: false, error: 'Reserva no encontrada' }

  const { error } = await admin.from('trip_reports').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    driver_id: booking.driver_id,
    category: cat,
    reason: cleanReason.slice(0, 2000),
  })

  if (error) {
    console.error('[reportDriverAction]', error)
    return { success: false, error: 'No se pudo enviar el reporte. Intenta de nuevo.' }
  }

  return { success: true }
}

// ─── Chat: listar mensajes (público por capability URL) ───────────────────────

export async function getTripMessagesAction(
  bookingId: string,
): Promise<{ success: boolean; messages?: TripMessage[]; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .single()
  if (!booking) return { success: false, error: 'Reserva no encontrada' }

  const { data } = await admin
    .from('trip_messages')
    .select('id, sender, body, created_at, read_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(200)

  const messages: TripMessage[] = (data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.created_at,
    readAt: m.read_at,
  }))
  return { success: true, messages }
}

// ─── Chat: el cliente envía un mensaje ────────────────────────────────────────

export async function sendClientMessageAction(
  bookingId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }
  const clean = (body ?? '').trim()
  if (clean.length < 1) return { success: false, error: 'Escribe un mensaje' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, company_id, status, driver_id, booking_number')
    .eq('id', bookingId)
    .single()
  if (!booking) return { success: false, error: 'Reserva no encontrada' }
  if (CHAT_CLOSED.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Este viaje ya finalizó.' }
  }

  const { error } = await admin.from('trip_messages').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    sender: 'client',
    body: clean.slice(0, 2000),
  })
  if (error) {
    console.error('[sendClientMessageAction]', error)
    return { success: false, error: 'No se pudo enviar el mensaje.' }
  }

  if (booking.driver_id) {
    const { notifyDriverPushInBackground } = await import('@/lib/notifications/push')
    notifyDriverPushInBackground(booking.driver_id, `Mensaje · ${booking.booking_number}`, clean.slice(0, 120), {
      bookingId: booking.id,
      type: 'chat_message',
    })
  }

  return { success: true }
}

// ─── Chat: el conductor envía un mensaje ──────────────────────────────────────

export async function sendDriverMessageAction(
  bookingId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const clean = (body ?? '').trim()
  if (clean.length < 1) return { success: false, error: 'Escribe un mensaje' }

  const user = await requireRole('driver')
  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, company_id, status')
    .eq('id', bookingId)
    .eq('driver_id', user.id) // solo sus viajes
    .single()
  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  if (CHAT_CLOSED.includes(booking.status as BookingStatus)) {
    return { success: false, error: 'Este viaje ya finalizó.' }
  }

  const { error } = await admin.from('trip_messages').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    sender: 'driver',
    body: clean.slice(0, 2000),
  })
  if (error) {
    console.error('[sendDriverMessageAction]', error)
    return { success: false, error: 'No se pudo enviar el mensaje.' }
  }
  revalidatePath('/driver/trips')
  return { success: true }
}

// ─── Conductor lista mensajes de su viaje ─────────────────────────────────────

export async function getDriverTripMessagesAction(
  bookingId: string,
): Promise<{ success: boolean; messages?: TripMessage[]; error?: string }> {
  const user = await requireRole('driver')
  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('driver_id', user.id)
    .single()
  if (!booking) return { success: false, error: 'Viaje no encontrado' }

  const { data } = await admin
    .from('trip_messages')
    .select('id, sender, body, created_at, read_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(200)

  const messages: TripMessage[] = (data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.created_at,
    readAt: m.read_at,
  }))
  return { success: true, messages }
}

// ─── Chat: acuses de lectura ───────────────────────────────────────────────────
// Marca como leídos los mensajes del OTRO lado (nunca los propios). El cliente
// lo hace por capability URL (sin login); el conductor autenticado.

export async function markClientMessagesReadAction(bookingId: string): Promise<{ success: boolean }> {
  if (!UUID_RE.test(bookingId)) return { success: false }
  const admin = createAdminClient()
  await admin
    .from('trip_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .eq('sender', 'driver')
    .is('read_at', null)
  return { success: true }
}

export async function markDriverMessagesRead(user: SessionUser, bookingId: string): Promise<{ success: boolean }> {
  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('driver_id', user.id)
    .single()
  if (!booking) return { success: false }

  await admin
    .from('trip_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .eq('sender', 'client')
    .is('read_at', null)
  return { success: true }
}

export async function markDriverMessagesReadAction(bookingId: string): Promise<{ success: boolean }> {
  const user = await requireRole('driver')
  return markDriverMessagesRead(user, bookingId)
}
