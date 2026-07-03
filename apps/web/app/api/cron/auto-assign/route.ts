// ── Cron diario: barrido de respaldo para reservas pendientes sin conductor ───
// La auto-asignación ya se intenta al crear la reserva (ver
// lib/dispatch/auto-assign.ts) — este barrido es la red de respaldo (límite
// del plan Hobby de Vercel: los crons solo pueden correr 1 vez al día) para
// reservas que quedaron pendientes porque, al crearse, no había ningún
// conductor en servicio disponible en ese momento.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { tryAutoAssignDriver } from '@/lib/dispatch/auto-assign'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: pending } = await admin
    .from('bookings')
    .select(
      'id, company_id, booking_number, scheduled_at, duration_minutes, passenger_name, passenger_email, passenger_phone, pickup_location, dropoff_location, total_amount, currency',
    )
    .eq('status', 'pending')
    .is('driver_id', null)
    .limit(500)

  let assigned = 0
  for (const b of pending ?? []) {
    try {
      const result = await tryAutoAssignDriver(admin, {
        id: b.id,
        company_id: b.company_id,
        booking_number: b.booking_number,
        scheduled_at: b.scheduled_at,
        duration_minutes: b.duration_minutes,
        passenger_name: b.passenger_name,
        passenger_email: b.passenger_email,
        passenger_phone: b.passenger_phone,
        pickup_location: b.pickup_location,
        dropoff_location: b.dropoff_location,
        total_amount: b.total_amount,
        currency: b.currency,
      })
      if (result.assigned) assigned++
    } catch (e) {
      console.error('[cron/auto-assign]', b.id, e)
    }
  }

  return NextResponse.json({ ok: true, checked: pending?.length ?? 0, assigned })
}
