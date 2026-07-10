// ── Auto-asignación justa de conductores ───────────────────────────────────────
// Para operadores (incluido uno solo, el propio dueño manejando) que no quieren
// asignar cada reserva a mano: al crear una reserva, o en el barrido diario de
// respaldo, se intenta asignar automáticamente al conductor "en servicio"
// (drivers.is_available, controlado por el conductor mismo) más adecuado.
//
// "Más adecuado" = sin choque de horario con otro viaje que ya tenga, y entre
// los que califican, el que MENOS viajes tenga asignados HOY (reparto justo —
// nadie se queda sin viajes mientras otro acumula). Activo para todas las
// empresas de la plataforma (sin interruptor de configuración).

import { createAdminClient } from '@/lib/supabase/server'
import { notifyBookingEventInBackground } from '@/lib/notifications'
import { notifyDriverPushInBackground } from '@/lib/notifications/push'
import { getAppUrl } from '@/lib/app-url'

// Margen entre el fin estimado de un viaje y el inicio del siguiente para no
// considerarlos en conflicto — tiempo de traslado/descanso razonable.
const BUFFER_MINUTES = 45
// Duración asumida cuando el viaje no tiene duration_minutes calculado aún.
const DEFAULT_DURATION_MINUTES = 60

interface AutoAssignBooking {
  id: string
  company_id: string
  booking_number: string
  scheduled_at: string
  duration_minutes: number | null
  passenger_name: string | null
  passenger_email: string | null
  passenger_phone: string | null
  pickup_location: unknown
  dropoff_location: unknown
  total_amount: number | null
  currency: string | null
}

export interface AutoAssignResult {
  assigned: boolean
  driverId?: string
}

function windowFor(scheduledAt: string, durationMinutes: number | null): { start: number; end: number } {
  const start = new Date(scheduledAt).getTime() - BUFFER_MINUTES * 60_000
  const end = start + (BUFFER_MINUTES * 2 + (durationMinutes ?? DEFAULT_DURATION_MINUTES)) * 60_000
  return { start, end }
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * Intenta asignar automáticamente un conductor a una reserva recién creada
 * (status='pending', sin driver_id). No lanza — si no hay conductor elegible,
 * simplemente no asigna y la reserva queda pendiente para asignación manual
 * o el próximo barrido.
 */
export async function tryAutoAssignDriver(
  admin: ReturnType<typeof createAdminClient>,
  booking: AutoAssignBooking,
): Promise<AutoAssignResult> {
  // Respeta el interruptor Automático/Manual del Dispatch Board — si la
  // empresa lo apagó, la reserva se queda pendiente para asignación manual.
  const { data: company } = await admin
    .from('companies')
    .select('auto_assign_enabled')
    .eq('id', booking.company_id)
    .single()
  if (company && company.auto_assign_enabled === false) return { assigned: false }

  // Conductores en servicio de la empresa. Sección J: un conductor bloqueado
  // por compliance (licencia/permiso vencido) nunca es candidato, ni siquiera
  // si está marcado "disponible".
  const { data: availableDrivers } = await admin
    .from('drivers')
    .select('id, current_vehicle_id')
    .eq('company_id', booking.company_id)
    .eq('is_available', true)
    .eq('operational_block', false)
  const driverIds = (availableDrivers ?? []).map((d) => d.id)
  if (!driverIds.length) return { assigned: false }
  const currentVehicleByDriver = new Map((availableDrivers ?? []).map((d) => [d.id, d.current_vehicle_id]))

  // El vehículo que traen asignado tampoco puede estar bloqueado (seguro/
  // permiso for-hire/inspección vencidos) — si lo está, ese conductor queda
  // fuera hasta que se le reasigne un vehículo en regla.
  const vehicleIdsInPlay = Array.from(new Set(Array.from(currentVehicleByDriver.values()).filter((v): v is string => !!v)))
  const { data: vehicleBlockRows } = vehicleIdsInPlay.length
    ? await admin.from('vehicles').select('id, operational_block').in('id', vehicleIdsInPlay)
    : { data: [] as { id: string; operational_block: boolean }[] }
  const blockedVehicleIds = new Set((vehicleBlockRows ?? []).filter((v) => v.operational_block).map((v) => v.id))

  // Solo cuentan como "activos" los perfiles de conductor que siguen activos.
  const { data: activeProfiles } = await admin
    .from('user_profiles')
    .select('id')
    .in('id', driverIds)
    .eq('role', 'driver')
    .eq('is_active', true)
  const eligibleIds = new Set((activeProfiles ?? []).map((p) => p.id))
  if (!eligibleIds.size) return { assigned: false }

  // Viajes ya asignados/activos de esos conductores — solo para detectar
  // choques de horario con el nuevo viaje.
  const { data: activeBookings } = await admin
    .from('bookings')
    .select('driver_id, scheduled_at, duration_minutes')
    .in('driver_id', Array.from(eligibleIds))
    .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
    .neq('id', booking.id)

  const newWindow = windowFor(booking.scheduled_at, booking.duration_minutes)
  const conflicted = new Set<string>()
  for (const b of activeBookings ?? []) {
    if (!b.driver_id) continue
    const w = windowFor(b.scheduled_at, b.duration_minutes)
    if (overlaps(newWindow, w)) conflicted.add(b.driver_id)
  }

  // Reparto justo = menos viajes COMPLETADOS hoy. Si a un conductor le
  // cancelan/rechazan un viaje antes de empezarlo, ese viaje nunca llega a
  // 'completed' y por lo tanto no cuenta en su contra.
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const { data: completedToday } = await admin
    .from('bookings')
    .select('driver_id')
    .in('driver_id', Array.from(eligibleIds))
    .eq('status', 'completed')
    .gte('completed_at', todayStart.toISOString())

  const todayCount = new Map<string, number>()
  for (const b of completedToday ?? []) {
    if (!b.driver_id) continue
    todayCount.set(b.driver_id, (todayCount.get(b.driver_id) ?? 0) + 1)
  }

  const candidates = Array.from(eligibleIds).filter((id) => {
    if (conflicted.has(id)) return false
    const vehicleId = currentVehicleByDriver.get(id)
    return !(vehicleId && blockedVehicleIds.has(vehicleId))
  })
  if (!candidates.length) return { assigned: false }

  // Menos viajes hoy primero; empate → orden estable (el primero encontrado).
  candidates.sort((a, b) => (todayCount.get(a) ?? 0) - (todayCount.get(b) ?? 0))
  const driverId = candidates[0]

  // Vehículo con el que el conductor está trabajando ahora mismo — así el
  // pasajero ve marca/placa en /track aunque la asignación haya sido automática.
  const vehicleId = currentVehicleByDriver.get(driverId) ?? null

  const now = new Date().toISOString()
  const { error } = await admin
    .from('bookings')
    .update({ driver_id: driverId, status: 'assigned', dispatched_at: now, ...(vehicleId ? { vehicle_id: vehicleId } : {}) })
    .eq('id', booking.id)
    .eq('status', 'pending') // guard de carrera: no pisar una asignación manual que llegó primero

  if (error) {
    console.error('[tryAutoAssignDriver]', error)
    return { assigned: false }
  }

  await admin.from('booking_events').insert({
    booking_id: booking.id,
    company_id: booking.company_id,
    type: 'driver_reassigned',
    actor: 'system',
    reason: 'Auto-asignación',
    metadata: { new_driver_id: driverId, auto: true },
  })

  const pickup = (booking.pickup_location as { address?: string } | null)?.address ?? ''
  const dropoff = (booking.dropoff_location as { address?: string } | null)?.address ?? ''
  notifyBookingEventInBackground('driver_assigned', {
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
    extraVars: { tracking_url: `${getAppUrl()}/track/${booking.id}` },
  })

  notifyDriverPushInBackground(driverId, 'Nuevo viaje asignado', `${booking.booking_number} · ${pickup}`, {
    bookingId: booking.id,
    type: 'trip_assigned',
  })

  return { assigned: true, driverId }
}
