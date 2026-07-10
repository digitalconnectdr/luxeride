'use server'
// ── Sección G — LuxeRide Affiliate Network: server actions ────────────────────
// Convención del proyecto: TODAS las acciones usan service-role
// (createAdminClient) y hacen su propia autorización en código — igual que
// companies.ts/fleet.ts. RLS existe como defensa en profundidad, no como
// mecanismo principal de autorización.
//
// Invariante clave (ver docs/PENDING.md sección G): bookings.company_id/
// driver_id/vehicle_id/status NUNCA se modifican por este flujo — el viaje
// afiliado vive enteramente en affiliate_trips. La página de tracking del
// pasajero y /driver/trips leen affiliate_trips por separado para mostrar el
// progreso real sin tocar el booking original.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireRole, getCurrentUser } from '@/lib/auth/session'
import type { SessionUser } from '@/lib/auth/session'
import { getDefaultRoute } from '@/lib/auth/permissions'
import {
  computeResponseDeadline,
  computeMargin,
  canAffiliateRespond,
  canOwnerCancel,
  nextOperationalStatus,
  type AffiliateReason,
  type BrandingMode,
} from '@/lib/affiliates/engine'

export type AffiliateActionResult = { success: boolean; error?: string }

const MANAGER_ROLES = ['company_owner', 'company_admin', 'dispatcher'] as const

/** Zona aproximada a partir de una dirección formateada de Google — nunca la
 *  dirección exacta (protege al pasajero mientras el afiliado no ha aceptado). */
function approximateZone(address: string | undefined | null): string | null {
  if (!address) return null
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? null
  return parts[parts.length - 3] ?? parts[parts.length - 2] ?? parts[0]
}

// ─── Relaciones de afiliación ──────────────────────────────────────────────────

export async function findAffiliateBySlugAction(
  slug: string,
): Promise<{ id: string; name: string; city: string | null; logoUrl: string | null } | null> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('companies')
    .select('id, name, city, logo_url, status')
    .eq('slug', slug.trim().toLowerCase())
    .neq('id', user.company_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) return null
  return { id: data.id, name: data.name, city: data.city, logoUrl: data.logo_url }
}

export async function requestAffiliationAction(
  affiliateCompanyId: string,
  coverageNotes?: string,
): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
  if (affiliateCompanyId === user.company_id) return { success: false, error: 'No puedes afiliarte contigo mismo' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_affiliates').insert({
    requester_company_id: user.company_id,
    affiliate_company_id: affiliateCompanyId,
    coverage_notes: coverageNotes ?? null,
    requested_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una solicitud con esta empresa' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/affiliates')
  return { success: true }
}

export async function respondToAffiliationAction(
  companyAffiliateId: string,
  approve: boolean,
): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('company_affiliates')
    .select('id, requester_company_id, affiliate_company_id, status')
    .eq('id', companyAffiliateId)
    .single()

  if (!rel) return { success: false, error: 'Relación no encontrada' }
  // Solo el lado que NO solicitó puede aprobar/rechazar (evita autoaprobación).
  if (rel.affiliate_company_id !== user.company_id) return { success: false, error: 'No autorizado' }
  if (rel.status !== 'pending') return { success: false, error: 'Esta solicitud ya fue respondida' }

  const { error } = await admin
    .from('company_affiliates')
    .update({ status: approve ? 'approved' : 'rejected', responded_by: user.id, responded_at: new Date().toISOString() })
    .eq('id', companyAffiliateId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/affiliates')
  return { success: true }
}

export async function revokeAffiliationAction(companyAffiliateId: string): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('company_affiliates')
    .select('id, requester_company_id, affiliate_company_id')
    .eq('id', companyAffiliateId)
    .single()

  if (!rel) return { success: false, error: 'Relación no encontrada' }
  if (rel.requester_company_id !== user.company_id && rel.affiliate_company_id !== user.company_id) {
    return { success: false, error: 'No autorizado' }
  }

  const { error } = await admin
    .from('company_affiliates')
    .update({ status: 'revoked', responded_by: user.id, responded_at: new Date().toISOString() })
    .eq('id', companyAffiliateId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/affiliates')
  return { success: true }
}

export async function updateAffiliationTermsAction(
  companyAffiliateId: string,
  opts: { coverageNotes?: string; paymentTerms?: 'due_on_receipt' | 'net_7' | 'net_15' | 'net_30' },
): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('company_affiliates')
    .select('id, requester_company_id, affiliate_company_id')
    .eq('id', companyAffiliateId)
    .single()
  if (!rel) return { success: false, error: 'Relación no encontrada' }
  if (rel.requester_company_id !== user.company_id && rel.affiliate_company_id !== user.company_id) {
    return { success: false, error: 'No autorizado' }
  }

  const { error } = await admin
    .from('company_affiliates')
    .update({
      ...(opts.coverageNotes !== undefined ? { coverage_notes: opts.coverageNotes } : {}),
      ...(opts.paymentTerms !== undefined ? { payment_terms: opts.paymentTerms } : {}),
    })
    .eq('id', companyAffiliateId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/affiliates')
  return { success: true }
}

// ─── Enviar un viaje a un afiliado ─────────────────────────────────────────────

export async function sendBookingToAffiliateAction(opts: {
  bookingId: string
  companyAffiliateId: string
  reason: AffiliateReason
  offeredPrice: number
  brandingMode: BrandingMode
}): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()

  const [{ data: booking }, { data: rel }, { data: company }] = await Promise.all([
    admin
      .from('bookings')
      .select('id, company_id, status, pickup_location, vehicle_type_id, passenger_count, distance_miles, duration_minutes, scheduled_at, total_amount')
      .eq('id', opts.bookingId)
      .eq('company_id', user.company_id)
      .single(),
    admin
      .from('company_affiliates')
      .select('id, requester_company_id, affiliate_company_id, status')
      .eq('id', opts.companyAffiliateId)
      .single(),
    admin.from('companies').select('affiliate_network_enabled').eq('id', user.company_id).single(),
  ])

  if (!company?.affiliate_network_enabled) return { success: false, error: 'La red de afiliados no está activa para tu empresa' }
  if (!booking) return { success: false, error: 'Reserva no encontrada' }
  if (!rel || rel.status !== 'approved') return { success: false, error: 'Afiliado no válido o relación no aprobada' }
  if (rel.requester_company_id !== user.company_id && rel.affiliate_company_id !== user.company_id) {
    return { success: false, error: 'No autorizado' }
  }
  const affiliateCompanyId = rel.requester_company_id === user.company_id ? rel.affiliate_company_id : rel.requester_company_id
  if (opts.offeredPrice < 0) return { success: false, error: 'Precio inválido' }

  let vehicleTypeName: string | null = null
  if (booking.vehicle_type_id) {
    const { data: vt } = await admin.from('vehicle_types').select('name').eq('id', booking.vehicle_type_id).maybeSingle()
    vehicleTypeName = vt?.name ?? null
  }

  const pickup = booking.pickup_location as { address?: string } | null
  const scheduledAt = new Date(booking.scheduled_at)
  const expiresAt = computeResponseDeadline(scheduledAt)

  const { error } = await admin.from('affiliate_trips').insert({
    booking_id: booking.id,
    company_affiliate_id: opts.companyAffiliateId,
    owner_company_id: user.company_id,
    affiliate_company_id: affiliateCompanyId,
    reason: opts.reason,
    branding_mode: opts.brandingMode,
    preview_zone: approximateZone(pickup?.address),
    preview_scheduled_at: booking.scheduled_at,
    preview_vehicle_type: vehicleTypeName,
    preview_passenger_count: booking.passenger_count,
    preview_distance_miles: booking.distance_miles,
    preview_duration_minutes: booking.duration_minutes,
    offered_price: opts.offeredPrice,
    passenger_charged_amount: booking.total_amount,
    expires_at: expiresAt.toISOString(),
    requested_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Esta reserva ya tiene una solicitud activa con un afiliado' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${booking.id}`)
  return { success: true }
}

export async function cancelAffiliateTripAction(affiliateTripId: string, reason?: string): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('affiliate_trips')
    .select('id, owner_company_id, status')
    .eq('id', affiliateTripId)
    .single()

  if (!trip) return { success: false, error: 'Solicitud no encontrada' }
  if (trip.owner_company_id !== user.company_id) return { success: false, error: 'No autorizado' }
  if (!canOwnerCancel(trip.status as never)) return { success: false, error: 'Este viaje ya no se puede cancelar' }

  const { error } = await admin
    .from('affiliate_trips')
    .update({ status: 'cancelled', cancellation_reason: reason ?? null })
    .eq('id', affiliateTripId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  return { success: true }
}

// ─── Respuesta del afiliado (aceptar / rechazar / contraofertar) ──────────────

export async function respondToAffiliateTripAction(opts: {
  affiliateTripId: string
  decision: 'accept' | 'reject' | 'counter'
  counteredPrice?: number
}): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('affiliate_trips')
    .select('id, affiliate_company_id, status, expires_at, offered_price, passenger_charged_amount')
    .eq('id', opts.affiliateTripId)
    .single()

  if (!trip) return { success: false, error: 'Solicitud no encontrada' }
  if (trip.affiliate_company_id !== user.company_id) return { success: false, error: 'No autorizado' }
  if (!canAffiliateRespond(trip.status as never, trip.expires_at)) {
    return { success: false, error: 'Esta solicitud ya expiró o no está disponible' }
  }

  if (opts.decision === 'accept') {
    // Fase 2 (afiliado externo): Whop Connect es obligatorio antes de poder
    // aceptar cualquier solicitud paga — cierra la brecha de pago sin
    // verificación que el usuario rechazó explícitamente en el diseño
    // original (ver docs/PENDING.md sección G, "Fase 2").
    const { data: company } = await admin
      .from('companies')
      .select('is_external_affiliate, whop_connect_onboarded')
      .eq('id', user.company_id)
      .single()
    if (company?.is_external_affiliate && !company.whop_connect_onboarded) {
      return { success: false, error: 'Conecta tu cuenta de Whop antes de aceptar solicitudes pagas (Configuración → Whop Connect)' }
    }
  }

  if (opts.decision === 'reject') {
    const { error } = await admin.from('affiliate_trips').update({ status: 'rejected', responded_at: new Date().toISOString() }).eq('id', opts.affiliateTripId)
    if (error) return { success: false, error: error.message }
  } else if (opts.decision === 'counter') {
    if (opts.counteredPrice == null || opts.counteredPrice < 0) return { success: false, error: 'Precio inválido' }
    const { error } = await admin
      .from('affiliate_trips')
      .update({ status: 'countered', countered_price: opts.counteredPrice, responded_at: new Date().toISOString() })
      .eq('id', opts.affiliateTripId)
    if (error) return { success: false, error: error.message }
  } else {
    const agreedPrice = trip.offered_price
    const margin = trip.passenger_charged_amount != null
      ? computeMargin({ passengerChargedAmount: Number(trip.passenger_charged_amount), agreedPrice: Number(agreedPrice) })
      : null
    const { error } = await admin
      .from('affiliate_trips')
      .update({ status: 'accepted', agreed_price: agreedPrice, margin_amount: margin, responded_at: new Date().toISOString() })
      .eq('id', opts.affiliateTripId)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/admin/affiliates/requests')
  revalidatePath('/admin/bookings')
  return { success: true }
}

/** El owner acepta o rechaza la contraoferta del afiliado. */
export async function resolveCounterOfferAction(affiliateTripId: string, accept: boolean): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('affiliate_trips')
    .select('id, owner_company_id, status, countered_price, passenger_charged_amount')
    .eq('id', affiliateTripId)
    .single()

  if (!trip) return { success: false, error: 'Solicitud no encontrada' }
  if (trip.owner_company_id !== user.company_id) return { success: false, error: 'No autorizado' }
  if (trip.status !== 'countered') return { success: false, error: 'No hay contraoferta pendiente' }

  if (!accept) {
    const { error } = await admin.from('affiliate_trips').update({ status: 'rejected' }).eq('id', affiliateTripId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/admin/bookings')
    return { success: true }
  }

  const agreedPrice = Number(trip.countered_price)
  const margin = trip.passenger_charged_amount != null
    ? computeMargin({ passengerChargedAmount: Number(trip.passenger_charged_amount), agreedPrice })
    : null
  const { error } = await admin
    .from('affiliate_trips')
    .update({ status: 'accepted', agreed_price: agreedPrice, margin_amount: margin })
    .eq('id', affiliateTripId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/bookings')
  return { success: true }
}

// ─── Operación del viaje por parte del afiliado ───────────────────────────────

export async function assignAffiliateDriverAction(opts: {
  affiliateTripId: string
  driverId: string
  vehicleId: string
}): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const [{ data: trip }, { data: driver }, { data: vehicle }] = await Promise.all([
    admin.from('affiliate_trips').select('id, affiliate_company_id, status, booking_id').eq('id', opts.affiliateTripId).single(),
    admin.from('user_profiles').select('id, company_id, role').eq('id', opts.driverId).maybeSingle(),
    admin.from('vehicles').select('id, company_id').eq('id', opts.vehicleId).maybeSingle(),
  ])

  if (!trip) return { success: false, error: 'Solicitud no encontrada' }
  if (trip.affiliate_company_id !== user.company_id) return { success: false, error: 'No autorizado' }
  if (trip.status !== 'accepted') return { success: false, error: 'El viaje debe estar aceptado antes de asignar conductor' }
  if (!driver || driver.company_id !== user.company_id || driver.role !== 'driver') return { success: false, error: 'Conductor inválido' }
  if (!vehicle || vehicle.company_id !== user.company_id) return { success: false, error: 'Vehículo inválido' }

  const { error } = await admin
    .from('affiliate_trips')
    .update({ driver_id: opts.driverId, vehicle_id: opts.vehicleId, dispatched_at: new Date().toISOString() })
    .eq('id', opts.affiliateTripId)

  if (error) return { success: false, error: error.message }

  const { data: booking } = await admin.from('bookings').select('booking_number').eq('id', trip.booking_id).maybeSingle()
  const { notifyDriverPushInBackground } = await import('@/lib/notifications/push')
  notifyDriverPushInBackground(opts.driverId, 'Nuevo viaje de afiliado', booking?.booking_number ?? 'Viaje asignado', {
    affiliateTripId: opts.affiliateTripId,
    type: 'affiliate_trip_assigned',
  })

  revalidatePath('/admin/affiliates/requests')
  revalidatePath('/driver/trips')
  return { success: true }
}

const STATUS_TIMESTAMP_FIELD: Record<string, string> = {
  en_route: 'en_route_at',
  arrived: 'arrived_at',
  in_progress: 'started_at',
  completed: 'completed_at',
}

/** Avanza el viaje afiliado al siguiente paso operativo (en_route → arrived →
 *  in_progress → completed). Lo puede llamar el afiliado (staff) o el propio
 *  conductor asignado. Core reusable desde la Server Action web (cookie) y
 *  desde la ruta móvil bearer-token (`/api/mobile/driver/advance-affiliate-trip`). */
export async function advanceAffiliateTrip(user: SessionUser, affiliateTripId: string): Promise<AffiliateActionResult> {
  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('affiliate_trips')
    .select('id, status, driver_id, affiliate_company_id')
    .eq('id', affiliateTripId)
    .single()
  if (!trip) return { success: false, error: 'Solicitud no encontrada' }

  const isAssignedDriver = user.role === 'driver' && trip.driver_id === user.id
  const isAffiliateStaff =
    (MANAGER_ROLES as readonly string[]).includes(user.role) && trip.affiliate_company_id === user.company_id
  if (!isAssignedDriver && !isAffiliateStaff) return { success: false, error: 'No autorizado' }

  const next = nextOperationalStatus(trip.status as never)
  if (!next) return { success: false, error: 'No hay siguiente paso disponible' }

  const timestampField = STATUS_TIMESTAMP_FIELD[next]
  const { error } = await admin
    .from('affiliate_trips')
    .update({ status: next, ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}) })
    .eq('id', affiliateTripId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/affiliates/requests')
  revalidatePath('/driver/trips')
  return { success: true }
}

export async function advanceAffiliateTripAction(affiliateTripId: string): Promise<AffiliateActionResult> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'No autorizado' }
  return advanceAffiliateTrip(user, affiliateTripId)
}

// ─── Liquidación (settlement) ──────────────────────────────────────────────────

export async function updateAffiliateSettlementAction(opts: {
  affiliateTripId: string
  status: 'pending' | 'invoiced' | 'paid' | 'disputed'
  method?: string
  notes?: string
}): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: trip } = await admin
    .from('affiliate_trips')
    .select('id, owner_company_id, affiliate_company_id')
    .eq('id', opts.affiliateTripId)
    .single()

  if (!trip) return { success: false, error: 'Viaje no encontrado' }
  if (trip.owner_company_id !== user.company_id && trip.affiliate_company_id !== user.company_id) {
    return { success: false, error: 'No autorizado' }
  }

  const { error } = await admin
    .from('affiliate_trips')
    .update({
      settlement_status: opts.status,
      settlement_method: opts.method ?? null,
      settlement_notes: opts.notes ?? null,
      ...(opts.status === 'paid' ? { settled_at: new Date().toISOString(), settled_by: user.id } : {}),
    })
    .eq('id', opts.affiliateTripId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/affiliates/requests')
  return { success: true }
}

// ─── Monetización ──────────────────────────────────────────────────────────────

export async function toggleAffiliateNetworkAction(companyId: string, enabled: boolean): Promise<AffiliateActionResult> {
  await requireRole('super_admin')
  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .update({ affiliate_network_enabled: enabled, affiliate_network_enabled_at: enabled ? new Date().toISOString() : null })
    .eq('id', companyId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/super-admin/companies/${companyId}`)
  return { success: true }
}

export async function submitAffiliateNetworkLeadAction(opts: {
  companyName: string
  contactName: string
  email: string
  phone?: string
  message?: string
}): Promise<AffiliateActionResult> {
  const user = await requireRole('company_owner', 'company_admin')

  const admin = createAdminClient()
  const { error } = await admin.from('affiliate_network_leads').insert({
    company_id: user.company_id,
    requested_by: user.id,
    company_name: opts.companyName,
    contact_name: opts.contactName,
    email: opts.email,
    phone: opts.phone ?? null,
    message: opts.message ?? null,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/settings')
  return { success: true }
}

export async function updateAffiliateNetworkLeadStatusAction(
  leadId: string,
  status: 'new' | 'contacted' | 'converted' | 'rejected',
): Promise<AffiliateActionResult> {
  await requireRole('super_admin')
  const admin = createAdminClient()
  const { error } = await admin.from('affiliate_network_leads').update({ status }).eq('id', leadId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/super-admin/affiliate-leads')
  return { success: true }
}

// ─── Mensajería entre empresas ─────────────────────────────────────────────────
// Canal 1 (comercial, affiliateTripId=undefined) y canal 2 (operativo, atado a
// un viaje puntual) comparten la misma tabla — ver migración 39.

export interface AffiliateMessage {
  id: string
  senderCompanyId: string
  senderName: string | null
  body: string
  createdAt: string
}

export async function getAffiliateMessagesAction(
  companyAffiliateId: string,
  affiliateTripId?: string,
): Promise<{ success: boolean; messages?: AffiliateMessage[]; error?: string }> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('company_affiliates')
    .select('id, requester_company_id, affiliate_company_id')
    .eq('id', companyAffiliateId)
    .single()
  if (!rel || (rel.requester_company_id !== user.company_id && rel.affiliate_company_id !== user.company_id)) {
    return { success: false, error: 'No autorizado' }
  }

  let query = admin
    .from('affiliate_messages')
    .select('id, sender_company_id, body, created_at')
    .eq('company_affiliate_id', companyAffiliateId)
    .order('created_at', { ascending: true })
    .limit(200)
  query = affiliateTripId ? query.eq('affiliate_trip_id', affiliateTripId) : query.is('affiliate_trip_id', null)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }

  const senderIds = Array.from(new Set((data ?? []).map((m) => m.sender_company_id)))
  const { data: senders } = senderIds.length
    ? await admin.from('companies').select('id, name').in('id', senderIds)
    : { data: [] as { id: string; name: string }[] }
  const nameById = new Map((senders ?? []).map((c) => [c.id, c.name]))

  return {
    success: true,
    messages: (data ?? []).map((m) => ({
      id: m.id,
      senderCompanyId: m.sender_company_id,
      senderName: nameById.get(m.sender_company_id) ?? null,
      body: m.body,
      createdAt: m.created_at,
    })),
  }
}

export async function sendAffiliateMessageAction(
  companyAffiliateId: string,
  body: string,
  affiliateTripId?: string,
): Promise<AffiliateActionResult> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
  const trimmed = body.trim()
  if (!trimmed) return { success: false, error: 'Mensaje vacío' }

  const admin = createAdminClient()
  const { data: rel } = await admin
    .from('company_affiliates')
    .select('id, requester_company_id, affiliate_company_id')
    .eq('id', companyAffiliateId)
    .single()
  if (!rel || (rel.requester_company_id !== user.company_id && rel.affiliate_company_id !== user.company_id)) {
    return { success: false, error: 'No autorizado' }
  }

  const { error } = await admin.from('affiliate_messages').insert({
    company_affiliate_id: companyAffiliateId,
    affiliate_trip_id: affiliateTripId ?? null,
    sender_company_id: user.company_id,
    sender_user_id: user.id,
    body: trimmed,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ─── Fase 2 — Portal de afiliado externo ───────────────────────────────────────
// Una empresa FUERA de LuxeRide se une a la Red de Afiliados de quien la
// invita a través de un link de un solo uso (capability-URL, mismo patrón que
// bookings.id en /track/[id] — ver docs/PENDING.md sección G). Al aceptar se
// crea una fila REAL en `companies` (is_external_affiliate = true, sin plan/
// suscripción de LuxeRide) para que su conductor/vehículo se registren en las
// MISMAS tablas drivers/vehicles que ya existen.

const INVITE_EXPIRY_DAYS = 14

export async function createAffiliateInviteAction(
  coverageNotes?: string,
): Promise<AffiliateActionResult & { token?: string }> {
  const user = await requireRole(...MANAGER_ROLES)
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  // La UI ya oculta este botón si la Red de Afiliados no está habilitada,
  // pero eso es solo cosmético — se valida también acá para que no sea
  // posible generar invitaciones llamando la acción directo sin el addon.
  const { data: company } = await admin
    .from('companies')
    .select('affiliate_network_enabled')
    .eq('id', user.company_id)
    .single()
  if (!company?.affiliate_network_enabled) {
    return { success: false, error: 'La red de afiliados no está activa para tu empresa' }
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000)

  const { error } = await admin.from('affiliate_invite_tokens').insert({
    inviting_company_id: user.company_id,
    token,
    coverage_notes: coverageNotes ?? null,
    created_by: user.id,
    expires_at: expiresAt.toISOString(),
  })
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/affiliates')
  return { success: true, token }
}

export interface AffiliateInvitePreview {
  invitingCompanyName: string
  invitingCompanyLogoUrl: string | null
  valid: boolean
}

/** Lectura pública (sin sesión) para que la página de alta muestre quién invita. */
export async function getAffiliateInvitePreviewAction(token: string): Promise<AffiliateInvitePreview | null> {
  if (!token) return null
  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('affiliate_invite_tokens')
    .select('inviting_company_id, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite) return null

  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url')
    .eq('id', invite.inviting_company_id)
    .maybeSingle()

  return {
    invitingCompanyName: company?.name ?? '—',
    invitingCompanyLogoUrl: company?.logo_url ?? null,
    valid: !invite.used_at && new Date(invite.expires_at).getTime() > Date.now(),
  }
}

/** Alta ligera del afiliado externo — sin login previo, el token es la única
 *  autorización (igual que aceptar una invitación por link en cualquier SaaS).
 *  Firma (token, _prev, formData) para usarse con useFormState vía .bind(null, token),
 *  mismo patrón que signupAction en app/actions/auth.ts. */
export async function joinAsExternalAffiliateAction(
  token: string,
  _prev: AffiliateActionResult | null,
  formData: FormData,
): Promise<AffiliateActionResult> {
  const input = {
    companyName: (formData.get('company_name') as string) ?? '',
    city: (formData.get('city') as string) || undefined,
    firstName: (formData.get('first_name') as string) ?? '',
    lastName: (formData.get('last_name') as string) ?? '',
    email: (formData.get('email') as string) ?? '',
    phone: (formData.get('phone') as string) || undefined,
    password: (formData.get('password') as string) ?? '',
  }

  if (!token) return { success: false, error: 'Enlace inválido' }
  if (!input.companyName.trim()) return { success: false, error: 'Nombre de empresa requerido' }
  if (!input.firstName.trim() || !input.lastName.trim()) return { success: false, error: 'Nombre y apellido requeridos' }
  if (!input.email.trim()) return { success: false, error: 'Email requerido' }
  if (!input.password || input.password.length < 8) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('affiliate_invite_tokens')
    .select('id, inviting_company_id, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite) return { success: false, error: 'Enlace inválido' }
  if (invite.used_at) return { success: false, error: 'Este enlace de invitación ya fue usado' }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { success: false, error: 'Este enlace de invitación expiró' }

  // 1. Crear la empresa externa — sin plan/suscripción de LuxeRide (patrón de
  // signupAction en app/actions/auth.ts, adaptado: status 'active' de una vez,
  // sin trial, porque no hay período de prueba que ofrecer aquí).
  const slugBase = input.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'afiliado'
  let slug = slugBase
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await admin.from('companies').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      name: input.companyName.trim(),
      slug,
      status: 'active',
      plan: 'free',
      city: input.city?.trim() || null,
      is_external_affiliate: true,
    })
    .select('id')
    .single()
  if (companyError || !company) return { success: false, error: 'No se pudo crear la empresa' }

  // 2. Crear el usuario dueño (mismo patrón que signupAction).
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      company_id: company.id,
      role: 'company_owner',
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: input.phone ?? null,
    },
  })
  if (authError || !authUser.user) {
    await admin.from('companies').delete().eq('id', company.id)
    if (authError?.message?.toLowerCase().includes('already')) return { success: false, error: 'Ya existe una cuenta con este email' }
    return { success: false, error: 'No se pudo crear la cuenta' }
  }

  await admin.from('user_profiles').upsert({
    id: authUser.user.id,
    company_id: company.id,
    role: 'company_owner',
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    phone: input.phone ?? null,
  })

  // 3. Relación de afiliación YA aprobada — fue una invitación explícita, no
  // pasa por el flujo normal de solicitar/aprobar del marketplace interno.
  const { error: relError } = await admin.from('company_affiliates').insert({
    requester_company_id: invite.inviting_company_id,
    affiliate_company_id: company.id,
    status: 'approved',
    requested_by: authUser.user.id,
    responded_by: authUser.user.id,
    responded_at: new Date().toISOString(),
  })
  if (relError) {
    // No revertimos la cuenta ya creada — el dueño puede solicitar la
    // afiliación manualmente desde /admin/affiliates si esto llegara a fallar.
    console.error('[joinAsExternalAffiliateAction] company_affiliates insert error:', relError)
  }

  // 4. Token de un solo uso.
  await admin
    .from('affiliate_invite_tokens')
    .update({ used_at: new Date().toISOString(), used_by_company_id: company.id })
    .eq('id', invite.id)

  // 5. Iniciar sesión directo (mismo patrón que signupAction) y aterrizar en
  // /admin/dashboard — el layout admin oculta las secciones que no aplican
  // para is_external_affiliate = true.
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })
  if (signInError) redirect('/auth/login')

  revalidatePath('/', 'layout')
  redirect(getDefaultRoute('company_owner'))
}
