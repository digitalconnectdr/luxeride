'use server'
// ── Acciones del conductor ─────────────────────────────────────────────────────
// El driver solo puede avanzar SUS viajes y solo por el flujo operativo normal.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { SessionUser } from '@/lib/auth/session'
import { notifyBookingEventInBackground } from '@/lib/notifications'
import { getAppUrl } from '@/lib/app-url'
import type { BookingStatus } from '@/lib/supabase/database.types'

// ─── Disponibilidad del conductor (para auto-asignación de viajes) ────────────
// El conductor controla su propio "en servicio / fuera de servicio". Antes
// solo el admin podía tocar drivers.is_available (toggleDriverAvailability en
// fleet.ts) — la vista del conductor solo mostraba una etiqueta fija.

export async function setDriverAvailability(
  user: SessionUser,
  isAvailable: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  // upsert (no update): algunos conductores nunca llegaron a tener una fila
  // en `drivers` (solo user_profiles) — con update() eso falla en silencio
  // (0 filas afectadas, sin error) y el toggle parece no hacer nada.
  const { error } = await admin
    .from('drivers')
    .upsert({ id: user.id, company_id: user.company_id, is_available: isAvailable }, { onConflict: 'id' })

  if (error) {
    console.error('[setDriverAvailability]', error)
    return { success: false, error: 'Error al actualizar disponibilidad' }
  }

  revalidatePath('/driver/trips')
  revalidatePath('/dispatcher/dashboard')
  return { success: true }
}

export async function driverSetAvailabilityAction(
  isAvailable: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  return setDriverAvailability(user, isAvailable)
}

// Transiciones permitidas al conductor (subset de la máquina de estados)
const DRIVER_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus>> = {
  assigned:    'en_route',
  en_route:    'arrived',
  arrived:     'in_progress',
  in_progress: 'completed',
}

const NOTIFY_BY_STATUS: Partial<Record<BookingStatus, string>> = {
  en_route:  'driver_en_route',
  arrived:   'driver_arrived',
  completed: 'trip_completed',
}

// Núcleo compartido: recibe el usuario ya resuelto en vez de leerlo de las
// cookies de Next.js, para que tanto el server action (web) como la ruta API
// de la app móvil (autenticada por bearer token, sin cookies) puedan llamarlo
// sin duplicar la lógica de transición/notificación.
export async function advanceDriverTrip(
  user: SessionUser,
  bookingId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, driver_id, scheduled_at, total_amount, booking_number, passenger_name, passenger_email, passenger_phone, pickup_location, dropoff_location, currency')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .eq('driver_id', user.id) // SOLO sus viajes
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }

  const current = booking.status as BookingStatus
  const next = DRIVER_TRANSITIONS[current]
  if (!next) {
    return { success: false, error: `No puedes avanzar un viaje en estado "${current}"` }
  }

  const now = new Date().toISOString()
  const updates: {
    status: BookingStatus
    en_route_at?: string
    arrived_at?: string
    started_at?: string
    completed_at?: string
  } = { status: next }
  if (next === 'en_route')    updates.en_route_at  = now
  if (next === 'arrived')     updates.arrived_at   = now
  if (next === 'in_progress') updates.started_at   = now
  if (next === 'completed')   updates.completed_at = now

  const { error } = await admin
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .eq('driver_id', user.id)

  if (error) {
    console.error('[driverAdvanceTripAction]', error)
    return { success: false, error: 'Error al actualizar el viaje' }
  }

  // Notificar al pasajero
  const notifyType = NOTIFY_BY_STATUS[next]
  if (notifyType) {
    const pickup  = (booking.pickup_location as { address?: string } | null)?.address ?? ''
    const dropoff = (booking.dropoff_location as { address?: string } | null)?.address ?? ''
    notifyBookingEventInBackground(notifyType, {
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
      extraVars: { eta_minutes: '15', rating_url: `${getAppUrl()}/review/${booking.id}` },
    })
  }

  revalidatePath('/driver/trips')
  return { success: true }
}

export async function driverAdvanceTripAction(
  bookingId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  return advanceDriverTrip(user, bookingId)
}

// ─── Completar viaje desde la app móvil: pago en efectivo + firma ─────────────
// El conductor NO tiene permiso para registrar pagos por la ruta normal
// (recordManualPaymentAction exige rol de staff) — este es un permiso nuevo,
// más angosto: solo efectivo, y solo en SU PROPIO viaje. La firma es una
// imagen ya subida por la app al bucket "documents" (mismas policies de
// auto-upload por carpeta propia que ya existen) — aquí solo se persiste la
// ruta del archivo. Ambos son opcionales; siempre termina llamando a
// advanceDriverTrip para el cambio de estado real.
export async function completeDriverTripWithExtras(
  user: SessionUser,
  bookingId: string,
  extras: { cashAmount?: number; signaturePath?: string },
): Promise<{ success: boolean; error?: string }> {
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, booking_number, currency')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .eq('driver_id', user.id)
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  if (booking.status !== 'in_progress') {
    return { success: false, error: 'Solo puedes completar un viaje que está en curso' }
  }

  if (extras.cashAmount != null) {
    const amount = Math.round(Number(extras.cashAmount) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: 'Monto en efectivo inválido' }
    }
    const { error: paymentError } = await admin.from('payments').insert({
      company_id: user.company_id,
      booking_id: booking.id,
      amount,
      currency: booking.currency ?? 'USD',
      status: 'succeeded',
      payment_method: 'cash',
      description: `Efectivo | Booking ${booking.booking_number} | registrado por el conductor desde la app`,
      captured_at: new Date().toISOString(),
      metadata: { manual: true, method: 'cash', recorded_by: user.id, source: 'driver_mobile_app' },
    })
    if (paymentError) {
      console.error('[completeDriverTripWithExtras] payment', paymentError)
      return { success: false, error: 'Error al registrar el pago en efectivo' }
    }
  }

  if (extras.signaturePath) {
    const { error: signatureError } = await admin
      .from('bookings')
      .update({ passenger_signature_path: extras.signaturePath })
      .eq('id', bookingId)
    if (signatureError) {
      console.error('[completeDriverTripWithExtras] signature', signatureError)
      return { success: false, error: 'Error al guardar la firma' }
    }
  }

  return advanceDriverTrip(user, bookingId)
}

// ─── No-show: el pasajero no se presentó ──────────────────────────────────────
// Solo válido cuando el conductor ya llegó al punto (status = 'arrived').

export async function driverNoShowAction(
  bookingId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .eq('driver_id', user.id)
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  if (booking.status !== 'arrived') {
    return { success: false, error: 'Solo puedes marcar no-show después de llegar al punto de recogida' }
  }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'no_show', no_show_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('driver_id', user.id)

  if (error) {
    console.error('[driverNoShowAction]', error)
    return { success: false, error: 'Error al marcar no-show' }
  }

  revalidatePath('/driver/trips')
  return { success: true }
}

// ─── Calificación del pasajero (conductor→pasajero, uso interno) ───────────────
// Espejo de submitReviewAction (pasajero→conductor). Solo el conductor asignado,
// solo viajes completados, solo una vez. Nunca se muestra al pasajero.

export async function submitDriverRating(
  user: SessionUser,
  bookingId: string,
  rating: number,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  const stars = Math.round(Number(rating))
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { success: false, error: 'Calificación inválida' }
  }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, driver_rated_at')
    .eq('id', bookingId)
    .eq('driver_id', user.id)
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  if (booking.status !== 'completed') return { success: false, error: 'El viaje aún no ha finalizado' }
  if (booking.driver_rated_at) return { success: false, error: 'Ya calificaste este viaje' }

  const trimmed = comment.trim().slice(0, 1000)
  const { error } = await admin
    .from('bookings')
    .update({
      driver_rating: stars,
      driver_rating_comment: trimmed || null,
      driver_rated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('driver_id', user.id)
    .is('driver_rated_at', null) // guard de carrera

  if (error) {
    console.error('[submitDriverRatingAction]', error)
    return { success: false, error: 'Error al guardar la calificación' }
  }

  revalidatePath('/driver/trips')
  return { success: true }
}

export async function submitDriverRatingAction(
  bookingId: string,
  rating: number,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  return submitDriverRating(user, bookingId, rating, comment)
}

// ─── Revelar número del pasajero (bajo demanda, con auditoría) ─────────────────
// El número se oculta por defecto. Esta acción lo devuelve SOLO al conductor
// asignado y registra la revelación en audit_logs (aparece en /admin/audit), para
// que el operador detecte abuso y aplique sanciones.

export async function revealPassengerPhoneAction(
  bookingId: string,
): Promise<{ success: boolean; phone?: string; error?: string }> {
  const user = await requireRole('driver')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, passenger_phone, passenger_name, booking_number')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .eq('driver_id', user.id) // solo el conductor asignado
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  if (!booking.passenger_phone) return { success: false, error: 'Sin teléfono' }

  // Auditar la revelación (no bloquea si falla el log).
  try {
    await admin.from('audit_logs').insert({
      company_id: user.company_id,
      user_id: user.id,
      action: 'REVEAL_PHONE',
      table_name: 'bookings',
      record_id: bookingId,
      metadata: {
        booking_number: booking.booking_number,
        passenger_name: booking.passenger_name,
      },
    })
  } catch (err) {
    console.error('[revealPassengerPhoneAction] audit', err)
  }

  return { success: true, phone: booking.passenger_phone }
}

// ─── Rechazar un viaje asignado (antes de iniciar ruta) ────────────────────────
// Solo mientras status='assigned' — una vez el conductor ya inició la ruta, un
// rechazo se maneja como cancelación/reasignación normal, no como esto. Libera
// el viaje de vuelta a 'pending' para que el dispatcher lo reasigne, y deja
// registro del motivo en booking_events (bitácora, no cambia el enum de status).

export async function driverRejectTrip(
  user: SessionUser,
  bookingId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .eq('driver_id', user.id)
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  if (booking.status !== 'assigned') {
    return { success: false, error: 'Solo puedes rechazar un viaje antes de iniciar la ruta' }
  }

  const { error } = await admin
    .from('bookings')
    .update({ driver_id: null, vehicle_id: null, status: 'pending', dispatched_at: null })
    .eq('id', bookingId)
    .eq('driver_id', user.id)

  if (error) {
    console.error('[driverRejectTripAction]', error)
    return { success: false, error: 'Error al rechazar el viaje' }
  }

  await admin.from('booking_events').insert({
    booking_id: bookingId,
    company_id: booking.company_id,
    type: 'driver_rejected',
    actor: 'driver',
    actor_id: user.id,
    reason: reason.trim().slice(0, 500) || null,
  })

  revalidatePath('/driver/trips')
  revalidatePath('/dispatcher/dashboard')
  return { success: true }
}

export async function driverRejectTripAction(
  bookingId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  return driverRejectTrip(user, bookingId, reason)
}

// ─── Reportar un incidente durante un viaje activo ─────────────────────────────
// No cambia el estado del viaje (es una alerta, no una transición) — el
// operador decide qué hacer (reasignar, cancelar, dejar continuar) desde el
// dispatch board. Se notifica por email al contacto de la empresa.

const INCIDENT_CATEGORIES = ['accident', 'breakdown', 'safety', 'unable_to_reach_passenger', 'other']

export async function reportDriverIncident(
  user: SessionUser,
  bookingId: string,
  category: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  if (!INCIDENT_CATEGORIES.includes(category)) return { success: false, error: 'Categoría inválida' }
  const cleanReason = reason.trim()
  if (!cleanReason) return { success: false, error: 'Describe brevemente el incidente' }

  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, company_id, booking_number, passenger_name')
    .eq('id', bookingId)
    .eq('company_id', user.company_id)
    .eq('driver_id', user.id)
    .single()

  if (!booking) return { success: false, error: 'Viaje no encontrado o no asignado a ti' }
  const activeStatuses = ['en_route', 'arrived', 'in_progress']
  if (!activeStatuses.includes(booking.status)) {
    return { success: false, error: 'Solo puedes reportar un incidente durante un viaje activo' }
  }

  const { error } = await admin.from('booking_events').insert({
    booking_id: bookingId,
    company_id: booking.company_id,
    type: 'driver_incident',
    actor: 'driver',
    actor_id: user.id,
    reason: cleanReason.slice(0, 1000),
    metadata: { category },
  })
  if (error) {
    console.error('[reportDriverIncidentAction]', error)
    return { success: false, error: 'Error al registrar el incidente' }
  }

  // Alerta por email al contacto de la empresa — no bloquea si falla.
  try {
    const { data: company } = await admin.from('companies').select('email').eq('id', user.company_id).single()
    if (company?.email) {
      const { notify } = await import('@/lib/notifications')
      await notify({
        companyId: user.company_id,
        channel: 'email',
        type: 'driver_incident_alert',
        recipient: company.email,
        vars: {
          booking_number: booking.booking_number,
          driver_name: `${user.profile.first_name} ${user.profile.last_name}`,
          category,
          reason: cleanReason,
          passenger_name: booking.passenger_name ?? 'Pasajero',
        },
        bookingId,
      })
    }
  } catch (err) {
    console.error('[reportDriverIncidentAction] alert', err)
  }

  revalidatePath('/driver/trips')
  revalidatePath('/dispatcher/dashboard')
  return { success: true }
}

export async function reportDriverIncidentAction(
  bookingId: string,
  category: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  return reportDriverIncident(user, bookingId, category, reason)
}
