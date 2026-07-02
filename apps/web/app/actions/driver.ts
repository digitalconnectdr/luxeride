'use server'
// ── Acciones del conductor ─────────────────────────────────────────────────────
// El driver solo puede avanzar SUS viajes y solo por el flujo operativo normal.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { notifyBookingEventInBackground } from '@/lib/notifications'
import { getAppUrl } from '@/lib/app-url'
import type { BookingStatus } from '@/lib/supabase/database.types'

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

export async function driverAdvanceTripAction(
  bookingId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
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

export async function submitDriverRatingAction(
  bookingId: string,
  rating: number,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  const stars = Math.round(Number(rating))
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { success: false, error: 'Calificación inválida' }
  }

  const user = await requireRole('driver')
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
