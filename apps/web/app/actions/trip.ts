'use server'
// ── Acciones del viaje: cancelación del cliente, reporte y chat ────────────────
// El pasajero NO tiene login: el UUID de la reserva en el link de seguimiento
// actúa como capability URL. Toda acción pública valida el UUID y opera con
// service-role. El conductor sí está autenticado (requireRole('driver')).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { BookingStatus } from '@/lib/supabase/database.types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Estados en los que el cliente todavía puede cancelar (antes de iniciar el viaje)
const CLIENT_CANCELLABLE: BookingStatus[] = ['pending', 'assigned', 'en_route', 'arrived']
// Estados terminales donde el chat ya no aplica
const CHAT_CLOSED: BookingStatus[] = ['completed', 'cancelled', 'no_show', 'failed']

export interface TripMessage {
  id: string
  sender: 'client' | 'driver'
  body: string
  createdAt: string
}

// ─── Cancelación por el cliente ───────────────────────────────────────────────

export async function cancelTripByClientAction(
  bookingId: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(bookingId)) return { success: false, error: 'Reserva inválida' }

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status')
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

  revalidatePath(`/track/${bookingId}`)
  return { success: true }
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
    .select('id, sender, body, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(200)

  const messages: TripMessage[] = (data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.created_at,
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
    .select('id, company_id, status')
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
    .select('id, sender, body, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
    .limit(200)

  const messages: TripMessage[] = (data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.created_at,
  }))
  return { success: true, messages }
}
