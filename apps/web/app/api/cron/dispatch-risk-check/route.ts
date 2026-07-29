// ── Protocolo de respaldo (Guaranteed Ride) — vigilancia cada pocos minutos ────
// A diferencia de app/api/cron/auto-assign/route.ts (barrido DIARIO, límite del
// plan Hobby de Vercel), esta ruta la llama pg_cron de Supabase cada ~5
// minutos vía net.http_post (ver migración de pg_cron) — así sí puede detectar
// a tiempo un conductor que no se mueve hacia el pickup, cosa que un cron
// diario nunca alcanzaría a ver. Mismo header Bearer + CRON_SECRET que los
// crons de Vercel, la única diferencia es quién dispara la llamada.
//
// Alcance: solo empresas con companies.settings.dispatch.backup_protocol_enabled
// = true (opt-in, disponible en todos los planes) y reservas ya asignadas
// ('assigned'/'en_route') con pickup dentro de la ventana de riesgo.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isDriverAtRisk, RISK_WINDOW_MINUTES } from '@/lib/dispatch/risk'
import { reassignForRisk } from '@/lib/dispatch/auto-assign'

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
  const now = new Date()
  const horizon = new Date(now.getTime() + RISK_WINDOW_MINUTES * 60_000).toISOString()

  // Solo empresas con el toggle activo — se consulta primero para no traer
  // reservas de empresas que nunca van a usar este protocolo.
  const { data: companies } = await admin.from('companies').select('id, settings')
  const enabledCompanyIds = (companies ?? [])
    .filter((c) => (c.settings as { dispatch?: { backup_protocol_enabled?: boolean } } | null)?.dispatch?.backup_protocol_enabled === true)
    .map((c) => c.id)
  if (!enabledCompanyIds.length) {
    return NextResponse.json({ ok: true, checked: 0, reassigned: 0, note: 'sin empresas con el protocolo activo' })
  }

  const { data: atRiskWindow } = await admin
    .from('bookings')
    .select(
      'id, company_id, booking_number, scheduled_at, duration_minutes, driver_id, customer_id, vehicle_type_id, pickup_location, dropoff_location, passenger_name, passenger_email, passenger_phone, total_amount, currency',
    )
    .in('company_id', enabledCompanyIds)
    .in('status', ['assigned', 'en_route'])
    .not('driver_id', 'is', null)
    .lte('scheduled_at', horizon)
    .gte('scheduled_at', now.toISOString())
    .limit(500)

  const bookings = atRiskWindow ?? []
  if (!bookings.length) {
    return NextResponse.json({ ok: true, checked: 0, reassigned: 0 })
  }

  const driverIds = Array.from(new Set(bookings.map((b) => b.driver_id).filter((id): id is string => !!id)))
  const { data: presenceRows } = await admin
    .from('driver_presence')
    .select('driver_id, latitude, longitude, updated_at')
    .in('driver_id', driverIds)
  const presenceByDriver = new Map(
    (presenceRows ?? []).map((p) => [p.driver_id, { lat: p.latitude, lng: p.longitude, updatedAt: p.updated_at }]),
  )

  let reassigned = 0
  for (const b of bookings) {
    try {
      const pickup = b.pickup_location as { lat?: number; lng?: number } | null
      if (typeof pickup?.lat !== 'number' || typeof pickup?.lng !== 'number') continue
      const presence = b.driver_id ? presenceByDriver.get(b.driver_id) : undefined

      const atRisk = isDriverAtRisk({
        scheduledAt: new Date(b.scheduled_at),
        pickup: { lat: pickup.lat, lng: pickup.lng },
        lastPosition: presence ? { lat: presence.lat, lng: presence.lng } : null,
        lastPositionAt: presence ? new Date(presence.updatedAt) : null,
        now,
      })
      if (!atRisk || !b.driver_id) continue

      const result = await reassignForRisk(admin, {
        id: b.id,
        company_id: b.company_id,
        booking_number: b.booking_number,
        scheduled_at: b.scheduled_at,
        duration_minutes: b.duration_minutes,
        driver_id: b.driver_id,
        customer_id: b.customer_id,
        vehicle_type_id: b.vehicle_type_id,
        pickup_location: b.pickup_location,
        dropoff_location: b.dropoff_location,
        passenger_name: b.passenger_name,
        passenger_email: b.passenger_email,
        passenger_phone: b.passenger_phone,
        total_amount: b.total_amount,
        currency: b.currency,
      })
      if (result.reassigned) reassigned++
    } catch (e) {
      console.error('[cron/dispatch-risk-check]', b.id, e)
    }
  }

  return NextResponse.json({ ok: true, checked: bookings.length, reassigned })
}
