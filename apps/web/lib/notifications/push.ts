// ── Push (Expo) — conductor (nuevo viaje/chat) y pasajero (estado del viaje) ──
// A diferencia de notify() (email/SMS, con templates por empresa y multi-
// idioma), esto es un aviso operativo corto sin pasar por
// notification_templates — mismo alcance ya aceptado de "las apps móviles
// son 100% español por ahora" (ver docs/PHASE-2-MOBILE.md). Gratis, sin
// config de Firebase — usa la Expo Push API directamente. `device_tokens`
// es una tabla genérica por user_id (no específica de conductor), así que
// la misma función sirve para ambos.

import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  if (!tokens.length) return
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: 'default', data: data ?? {} }))),
    })
  } catch (err) {
    console.error('[sendExpoPush]', err)
  }
}

export async function notifyUserPush(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('device_tokens').select('expo_push_token').eq('user_id', userId)
  const tokens = (rows ?? []).map((r) => r.expo_push_token)
  await sendExpoPush(tokens, title, body, data)
}

/** Fire-and-forget, mismo patrón que notifyBookingEventInBackground — nunca bloquea al que la llama. */
export function notifyUserPushInBackground(userId: string, title: string, body: string, data?: Record<string, unknown>): void {
  const job = notifyUserPush(userId, title, body, data).catch((err) => {
    console.error('[notifyUserPushInBackground]', err)
  })
  waitUntil(job)
}

// Alias — mantiene sin cambios los call sites existentes del conductor.
export const notifyDriverPush = notifyUserPush
export const notifyDriverPushInBackground = notifyUserPushInBackground
