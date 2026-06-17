'use server'
// ── Acciones del conductor ─────────────────────────────────────────────────────
// El driver solo puede avanzar SUS viajes y solo por el flujo operativo normal.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { notifyBookingEventInBackground } from '@/lib/notifications'
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
      extraVars: { eta_minutes: '15' },
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
