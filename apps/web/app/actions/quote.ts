'use server'
// ── Aceptación pública de cotización ───────────────────────────────────────────
// El cliente recibe /quote/<bookingId> (UUID = secreto, como /track y /review).
// Acepta → la cotización (status 'quote') se confirma (status 'pending') y se
// envía la confirmación. Rechaza → se cancela. Sin auth.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyBookingEventInBackground } from '@/lib/notifications'

async function loadQuote(bookingId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('bookings')
    .select('id, status, company_id, booking_number, passenger_name, passenger_email, passenger_phone, scheduled_at, pickup_location, dropoff_location, total_amount, currency')
    .eq('id', bookingId)
    .single()
  return { admin, booking: data }
}

export async function acceptQuoteAction(bookingId: string): Promise<{ success: boolean; error?: string }> {
  if (!bookingId) return { success: false, error: 'invalid' }
  const { admin, booking } = await loadQuote(bookingId)
  if (!booking) return { success: false, error: 'not_found' }
  if (booking.status !== 'quote') return { success: false, error: 'not_quote' }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'pending' })
    .eq('id', bookingId)
    .eq('status', 'quote') // guard de carrera
  if (error) {
    console.error('[acceptQuoteAction]', error)
    return { success: false, error: 'failed' }
  }

  // Confirmar al pasajero (email + SMS) — reusa el template booking_confirmation.
  const pickup = (booking.pickup_location as { address?: string } | null)?.address ?? ''
  const dropoff = (booking.dropoff_location as { address?: string } | null)?.address ?? ''
  notifyBookingEventInBackground('booking_confirmation', {
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
  })

  revalidatePath(`/quote/${bookingId}`)
  return { success: true }
}

export async function declineQuoteAction(bookingId: string): Promise<{ success: boolean; error?: string }> {
  if (!bookingId) return { success: false, error: 'invalid' }
  const { admin, booking } = await loadQuote(bookingId)
  if (!booking) return { success: false, error: 'not_found' }
  if (booking.status !== 'quote') return { success: false, error: 'not_quote' }

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: 'Cotización rechazada por el cliente' })
    .eq('id', bookingId)
    .eq('status', 'quote')
  if (error) {
    console.error('[declineQuoteAction]', error)
    return { success: false, error: 'failed' }
  }

  revalidatePath(`/quote/${bookingId}`)
  return { success: true }
}
