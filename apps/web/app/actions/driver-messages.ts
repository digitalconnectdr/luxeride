'use server'
// ── Chat Dispatch ↔ Conductor (canal general, no atado a una reserva) ──────────
// A diferencia de trip_messages (por reserva, cliente↔conductor), este canal
// vive en driver_messages y sirve para que Dispatch contacte a un conductor
// "en servicio" aunque no tenga un viaje activo (avisar un cambio, preguntar
// disponibilidad, etc.) — ver el panel de conductores activos del Dispatch Board.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

export interface DriverChannelMessage {
  id: string
  sender: 'dispatch' | 'driver'
  senderName: string | null
  body: string
  createdAt: string
  readAt: string | null
}

function mapRows(
  data: { id: string; sender: string; sender_name: string | null; body: string; created_at: string; read_at: string | null }[] | null,
): DriverChannelMessage[] {
  return (data ?? []).map((m) => ({
    id: m.id,
    sender: m.sender as 'dispatch' | 'driver',
    senderName: m.sender_name,
    body: m.body,
    createdAt: m.created_at,
    readAt: m.read_at,
  }))
}

// ─── Lado Dispatch (dispatcher/admin/owner) ───────────────────────────────────

export async function getDispatchDriverMessagesAction(
  driverId: string,
): Promise<{ success: boolean; messages?: DriverChannelMessage[]; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'super_admin')
  const admin = createAdminClient()

  const { data: driver } = await admin
    .from('user_profiles')
    .select('id')
    .eq('id', driverId)
    .eq('company_id', user.company_id ?? '')
    .eq('role', 'driver')
    .single()
  if (!driver) return { success: false, error: 'Conductor no encontrado' }

  const { data } = await admin
    .from('driver_messages')
    .select('id, sender, sender_name, body, created_at, read_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: true })
    .limit(200)

  return { success: true, messages: mapRows(data) }
}

export async function sendDispatchMessageAction(
  driverId: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const clean = (body ?? '').trim()
  if (clean.length < 1) return { success: false, error: 'Escribe un mensaje' }

  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'super_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
  const admin = createAdminClient()

  const { data: driver } = await admin
    .from('user_profiles')
    .select('id')
    .eq('id', driverId)
    .eq('company_id', user.company_id)
    .eq('role', 'driver')
    .single()
  if (!driver) return { success: false, error: 'Conductor no encontrado' }

  const { error } = await admin.from('driver_messages').insert({
    company_id: user.company_id,
    driver_id: driverId,
    sender: 'dispatch',
    sender_name: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
    body: clean.slice(0, 2000),
  })
  if (error) {
    console.error('[sendDispatchMessageAction]', error)
    return { success: false, error: 'No se pudo enviar el mensaje.' }
  }
  return { success: true }
}

/** Vacía el hilo completo con un conductor — evita que se acumule sin
 *  control; cualquiera de los dos lados puede iniciarlo (ver acción gemela
 *  clearDriverChannelMessagesAction para el lado conductor). */
export async function clearDriverMessagesAction(driverId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'super_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
  const admin = createAdminClient()

  const { error } = await admin
    .from('driver_messages')
    .delete()
    .eq('driver_id', driverId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[clearDriverMessagesAction]', error)
    return { success: false, error: 'No se pudo vaciar el chat' }
  }
  return { success: true }
}

export async function markDispatchMessagesReadAction(driverId: string): Promise<{ success: boolean }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'super_admin')
  if (!user.company_id) return { success: false }
  const admin = createAdminClient()

  await admin
    .from('driver_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('driver_id', driverId)
    .eq('company_id', user.company_id)
    .eq('sender', 'driver')
    .is('read_at', null)
  return { success: true }
}

/** Cantidad de mensajes sin leer por conductor — para el badge del panel de
 *  conductores activos, sin tener que abrir cada hilo. */
export async function getUnreadDriverMessageCountsAction(): Promise<Record<string, number>> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'super_admin')
  if (!user.company_id) return {}
  const admin = createAdminClient()

  const { data } = await admin
    .from('driver_messages')
    .select('driver_id')
    .eq('company_id', user.company_id)
    .eq('sender', 'driver')
    .is('read_at', null)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.driver_id] = (counts[row.driver_id] ?? 0) + 1
  }
  return counts
}

// ─── Lado Conductor ────────────────────────────────────────────────────────────

export async function getDriverChannelMessagesAction(): Promise<{
  success: boolean
  messages?: DriverChannelMessage[]
  error?: string
}> {
  const user = await requireRole('driver')
  const admin = createAdminClient()

  const { data } = await admin
    .from('driver_messages')
    .select('id, sender, sender_name, body, created_at, read_at')
    .eq('driver_id', user.id)
    .order('created_at', { ascending: true })
    .limit(200)

  return { success: true, messages: mapRows(data) }
}

export async function sendDriverChannelMessageAction(body: string): Promise<{ success: boolean; error?: string }> {
  const clean = (body ?? '').trim()
  if (clean.length < 1) return { success: false, error: 'Escribe un mensaje' }

  const user = await requireRole('driver')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
  const admin = createAdminClient()

  const { error } = await admin.from('driver_messages').insert({
    company_id: user.company_id,
    driver_id: user.id,
    sender: 'driver',
    sender_name: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
    body: clean.slice(0, 2000),
  })
  if (error) {
    console.error('[sendDriverChannelMessageAction]', error)
    return { success: false, error: 'No se pudo enviar el mensaje.' }
  }
  revalidatePath('/driver/trips')
  return { success: true }
}

export async function clearDriverChannelMessagesAction(): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('driver')
  const admin = createAdminClient()

  const { error } = await admin.from('driver_messages').delete().eq('driver_id', user.id)
  if (error) {
    console.error('[clearDriverChannelMessagesAction]', error)
    return { success: false, error: 'No se pudo vaciar el chat' }
  }
  return { success: true }
}

export async function markDriverChannelMessagesReadAction(): Promise<{ success: boolean }> {
  const user = await requireRole('driver')
  const admin = createAdminClient()

  await admin
    .from('driver_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('driver_id', user.id)
    .eq('sender', 'dispatch')
    .is('read_at', null)
  return { success: true }
}
