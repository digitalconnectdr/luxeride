// ── Recordatorios de viaje próximo (pasajero + conductor, email + SMS) ────────
// El operador configura umbrales en MINUTOS por separado para pasajero y
// conductor en /admin/settings (companies.settings.notificationReminders,
// ver app/actions/settings.ts). Este endpoint está registrado 1x/día en
// vercel.json como respaldo (límite del plan Hobby de Vercel), pero está
// pensado para dispararse cada 5-15 min vía un schedule de Upstash QStash —
// mismo CRON_SECRET como header HTTP `Authorization: Bearer <secret>`, sin
// tocar el plan de Vercel — para que los umbrales de minutos (30min, 1:30h,
// etc.) lleguen con precisión real. Dedup por booking+umbral+canal vía la
// tabla notifications (sendBookingReminder). Protegido con CRON_SECRET.

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
  passengerMinutes?: number[]
  driverMinutes?: number[]
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })
}

// GET: lo usa el cron de vercel.json. POST: lo usa el schedule de Upstash
// QStash (por defecto envía POST) — mismo handler para ambos.
export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}

async function handleRequest(request: Request) {
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
  const driverCache = new Map<string, { email: string | null; phone: string | null }>()

  async function getDriverContact(driverId: string): Promise<{ email: string | null; phone: string | null }> {
    const cached = driverCache.get(driverId)
    if (cached) return cached

    let email: string | null = null
    try {
      const { data } = await admin.auth.admin.getUserById(driverId)
      email = data.user?.email ?? null
    } catch {
      email = null
    }

    const { data: profile } = await admin
      .from('user_profiles')
      .select('phone')
      .eq('id', driverId)
      .single()
    const phone = profile?.phone ?? null

    const contact = { email, phone }
    driverCache.set(driverId, contact)
    return contact
  }

  for (const company of companies ?? []) {
    const reminders = (company.settings as { notificationReminders?: NotificationReminders } | null)
      ?.notificationReminders
    const passengerMinutes = reminders?.passengerMinutes ?? []
    const driverMinutes = reminders?.driverMinutes ?? []
    if (passengerMinutes.length === 0 && driverMinutes.length === 0) continue

    const maxMinutes = Math.max(...passengerMinutes, ...driverMinutes, 0)
    const windowEnd = new Date(now + maxMinutes * 60_000).toISOString()

    const { data: bookings } = await admin
      .from('bookings')
      .select('id, booking_number, status, scheduled_at, passenger_name, passenger_email, passenger_phone, driver_id, pickup_location, dropoff_location')
      .eq('company_id', company.id)
      .in('status', ACTIVE_STATUSES)
      .gte('scheduled_at', new Date(now).toISOString())
      .lte('scheduled_at', windowEnd)
      .limit(300)

    for (const b of bookings ?? []) {
      const scheduledAtMs = new Date(b.scheduled_at).getTime()
      const minutesUntil = (scheduledAtMs - now) / 60_000
      const pickup = (b.pickup_location as { address?: string } | null)?.address ?? ''
      const dropoff = (b.dropoff_location as { address?: string } | null)?.address ?? ''
      const when = formatWhen(b.scheduled_at)

      for (const m of passengerMinutes) {
        if (minutesUntil > m) continue // aún no entra en la ventana de este umbral
        const type = `reminder_passenger_${m}m`

        if (b.passenger_email) {
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
            channel: 'email',
            type,
            to: b.passenger_email,
            subject: `Recordatorio: tu viaje ${b.booking_number}`,
            body,
          })
          if (result.sent) passengerSent += 1
        }

        if (b.passenger_phone) {
          const smsBody = `${company.name}: recordatorio de tu viaje ${b.booking_number} el ${when}. Sigue tu viaje: ${appUrl}/track/${b.id}`
          const result = await sendBookingReminder({
            companyId: company.id,
            bookingId: b.id,
            channel: 'sms',
            type,
            to: b.passenger_phone,
            body: smsBody,
          })
          if (result.sent) passengerSent += 1
        }
      }

      if (!b.driver_id) continue
      const driverContact = await getDriverContact(b.driver_id)

      for (const m of driverMinutes) {
        if (minutesUntil > m) continue
        const type = `reminder_driver_${m}m`

        if (driverContact.email) {
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
            channel: 'email',
            type,
            to: driverContact.email,
            subject: `Recordatorio: viaje asignado ${b.booking_number}`,
            body,
          })
          if (result.sent) driverSent += 1
        }

        if (driverContact.phone) {
          const smsBody = `Viaje asignado ${b.booking_number} el ${when}. Recoger en: ${pickup || 'a confirmar'}`
          const result = await sendBookingReminder({
            companyId: company.id,
            bookingId: b.id,
            channel: 'sms',
            type,
            to: driverContact.phone,
            body: smsBody,
          })
          if (result.sent) driverSent += 1
        }
      }
    }
  }

  return NextResponse.json({ ok: true, passengerSent, driverSent })
}
