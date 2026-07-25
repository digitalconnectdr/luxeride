// ── Centro de notificaciones del pasajero (passenger_notifications) ──────────
// Análogo a admin-feed.ts pero para el pasajero de la app móvil.
//
// Diferencia de diseño importante: aquí el registro y el push van JUNTOS en
// una sola función. En el admin son cosas separadas (la campana es visual, no
// hay push), pero para el pasajero todo aviso que merece un push también
// merece quedar guardado — si fueran dos llamadas sueltas, tarde o temprano
// alguien agregaría un push nuevo y olvidaría el insert, y el aviso
// desaparecería al descartar la notificación del sistema.
//
// Nunca lanza: un fallo aquí no debe tumbar la acción principal (asignar un
// conductor, completar un viaje, correr un cron).

import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyUserPush } from '@/lib/notifications/push'

export type PassengerNotificationType =
  | 'driver_assigned'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'trip_completed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'reengagement'
  | 'chat_message'

export interface NotifyPassengerParams {
  /** user_profiles.id del pasajero (bookings.customer_id). */
  customerId: string
  type: PassengerNotificationType
  title: string
  body?: string
  bookingId?: string
  /**
   * false = solo guarda el registro, sin push nativo. Para avisos que el
   * pasajero ya está viendo en pantalla en ese momento y no vale la pena
   * empujarle al teléfono.
   */
  push?: boolean
}

/**
 * Guarda el aviso en el centro de notificaciones y (por defecto) manda el
 * push nativo. Await para propagar errores de red del push; el insert nunca
 * los deja escapar.
 */
export async function notifyPassenger(params: NotifyPassengerParams): Promise<void> {
  const { customerId, type, title, body, bookingId, push = true } = params

  try {
    const admin = createAdminClient()
    await admin.from('passenger_notifications').insert({
      customer_id: customerId,
      type,
      title,
      body: body ?? null,
      booking_id: bookingId ?? null,
    })
  } catch (err) {
    console.error('[notifyPassenger:insert]', err)
  }

  if (!push) return

  try {
    await notifyUserPush(customerId, title, body ?? '', { bookingId, type })
  } catch (err) {
    console.error('[notifyPassenger:push]', err)
  }
}

/** Fire-and-forget — mismo patrón que notifyUserPushInBackground. */
export function notifyPassengerInBackground(params: NotifyPassengerParams): void {
  const job = notifyPassenger(params).catch((err) => {
    console.error('[notifyPassengerInBackground]', err)
  })
  waitUntil(job)
}

/**
 * Purga avisos viejos. La app muestra 30 días; guardar más solo engorda la
 * tabla. Se llama desde el cron diario que ya limpia los del admin.
 */
export async function cleanupOldPassengerNotifications(): Promise<void> {
  try {
    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString()
    await admin.from('passenger_notifications').delete().lt('created_at', cutoff)
  } catch (err) {
    console.error('[cleanupOldPassengerNotifications]', err)
  }
}
