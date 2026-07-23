// ── Cron diario: recordatorios de viaje próximo (pasajero + conductor) ────────
// El operador configura umbrales en horas (ej. 6, 24) por separado para
// pasajero y conductor en /admin/settings (companies.settings.
// notificationReminders, ver app/actions/settings.ts). Este cron corre 1 vez
// al día (límite del plan Hobby de Vercel — mismo motivo que auto-assign y
// quote-followup), así que el aviso llega en algún momento del día en que el
// viaje entra en la ventana del umbral, no al minuto exacto. Dedup por
// booking+umbral vía la tabla notifications (sendBookingReminder). Protegido
// con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBookingReminder } from '@/lib/notifications'
import { getAppUrl } from '@/lib/app-url'
import type { BookingStatus } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'assigned', 'en_route']

interface NotificationReminders {
  passengerHours?: number[]
  driverHours?: number[]
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const appUrl = getAppUrl()
  const now = Date.now()

  const { data: companies } = await admin
    .from('companies')
    .select('id, name, settings')
    .eq('status', 'active')

  let passengerSent = 0
  let driverSent = 0
  const driverEmailCache = new Map<string, string | null>()

  async function getDriverEmail(driverId: string): Promise<string | null> {
    if (driverEmailCache.has(driverId)) return driverEmailCache.get(driverId) ?? null
    try {
      const { data } = await admin.auth.admin.getUserById(driverId)
      const email = data.user?.email ?? null
      driverEmailCache.set(driverId, email)
      return email
    } catch {
      driverEmailCache.set(driverId, null)
      return null
    }
  }

  for (const company of companies ?? []) {
    const reminders = (company.settings as { notificationReminders?: NotificationReminders } | null)
      ?.notificationReminders
    const passengerHours = reminders?.passengerHours ?? []
    const driverHours = reminders?.driverHours ?? []
    if (passengerHours.length === 0 && driverHours.length === 0) continue

    const maxHours = Math.max(...passengerHours, ...driverHours, 0)
    const windowEnd = new Date(now + maxHours * 3_600_000).toISOString()

    const { data: bookings } = await admin
      .from('bookings')
      .select('id, booking_number, status, scheduled_at, passenger_name, passenger_email, driver_id, pickup_location, dropoff_location')
      .eq('company_id', company.id)
      .in('status', ACTIVE_STATUSES)
      .gte('scheduled_at', new Date(now).toISOString())
      .lte('scheduled_at', windowEnd)
      .limit(300)

    for (const b of bookings ?? []) {
      const scheduledAtMs = new Date(b.scheduled_at).getTime()
      const hoursUntil = (scheduledAtMs - now) / 3_600_000
      const pickup = (b.pickup_location as { address?: string } | null)?.address ?? ''
      const dropoff = (b.dropoff_location as { address?: string } | null)?.address ?? ''
      const when = formatWhen(b.scheduled_at)

      for (const h of passengerHours) {
        if (hoursUntil > h) continue // aún no entra en la ventana de este umbral
        if (!b.passenger_email) break // sin email, ningún umbral de pasajero aplica
        const body = [
          `Hola ${b.passenger_name ?? ''}`.trim() + ',',
          '',
          `Te recordamos tu viaje con ${company.name} programado para: ${when}.`,
          '',
          `Origen: ${pickup || 'a confirmar'}`,
          `Destino: ${dropoff || 'a confirmar'}`,
          '',
          `Sigue tu viaje aquí: ${appUrl}/track/${b.id}`,
        ].join('\n')
        const result = await sendBookingReminder({
          companyId: company.id,
          bookingId: b.id,
          type: `reminder_passenger_${h}h`,
          to: b.passenger_email,
          subject: `Recordatorio: tu viaje ${b.booking_number}`,
          body,
        })
        if (result.sent) passengerSent += 1
      }

      if (!b.driver_id) continue
      const driverEmail = await getDriverEmail(b.driver_id)
      if (!driverEmail) continue

      for (const h of driverHours) {
        if (hoursUntil > h) continue
        const body = [
          'Hola,',
          '',
          `Te recordamos tu viaje asignado (${b.booking_number}) programado para: ${when}.`,
          '',
          `Recoger en: ${pickup || 'a confirmar'}`,
          `Destino: ${dropoff || 'a confirmar'}`,
        ].join('\n')
        const result = await sendBookingReminder({
          companyId: company.id,
          bookingId: b.id,
          type: `reminder_driver_${h}h`,
          to: driverEmail,
          subject: `Recordatorio: viaje asignado ${b.booking_number}`,
          body,
        })
        if (result.sent) driverSent += 1
      }
    }
  }

  return NextResponse.json({ ok: true, passengerSent, driverSent })
}
