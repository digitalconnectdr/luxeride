import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import { BookingActions } from './booking-actions'
import { SendToAffiliateCard, type AffiliateOption, type ActiveAffiliateTrip } from './send-to-affiliate-card'
import { BookingPayments } from '@/components/admin/booking-payments'
import { CopyButton } from '@/components/trip/copy-button'
import { getAppUrl } from '@/lib/app-url'
import { isStripeConfigured } from '@/lib/stripe/server'
import { isWhopConnectConfigured } from '@/lib/whop/connect-server'
import type { BookingStatus } from '@/lib/supabase/database.types'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.bookingDetail.title }
}

interface LocationJson {
  address?: string
  lat?: number
  lng?: number
  notes?: string
}

function parseLocation(raw: unknown): LocationJson {
  if (!raw || typeof raw !== 'object') return {}
  return raw as LocationJson
}

function fmt(iso: string | null, tag: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(tag, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await requireRole(
    'super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting',
  )

  const t = getDict().admin.bookingDetail
  const statusLabels = getDict().admin.bookingStatuses
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  if (!user.company_id) return notFound()

  const admin = createAdminClient()
  const companyId = user.company_id

  const { data: booking } = await admin
    .from('bookings')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', companyId)
    .single()

  if (!booking) return notFound()

  // Datos relacionados
  const [{ data: fees }, { data: drivers }, { data: vehicleType }, { data: payments }, { data: events }] = await Promise.all([
    admin
      .from('booking_fees')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at'),
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', companyId)
      .eq('role', 'driver')
      .eq('is_active', true)
      .order('first_name'),
    booking.vehicle_type_id
      ? admin
          .from('vehicle_types')
          .select('id, name, class, capacity')
          .eq('id', booking.vehicle_type_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from('payments')
      .select('id, amount, currency, status, payment_method, description, failure_message, captured_at, created_at')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false }),
    admin
      .from('booking_events')
      .select('id, type, actor, actor_id, reason, metadata, created_at')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false }),
  ])

  // Conductor asignado
  let driverName = '—'
  if (booking.driver_id) {
    const { data: driver } = await admin
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', booking.driver_id)
      .single()
    if (driver) driverName = `${driver.first_name} ${driver.last_name}`
  }

  // Vehículo asignado (distinto del "tipo de vehículo" cotizado)
  let assignedVehicle: { make: string; model: string; plate_number: string } | null = null
  if (booking.vehicle_id) {
    const { data: vehicle } = await admin
      .from('vehicles')
      .select('make, model, plate_number')
      .eq('id', booking.vehicle_id)
      .single()
    assignedVehicle = vehicle
  }

  // Audit trail — nombres de quién creó / despachó / canceló la reserva
  const staffIds = [booking.created_by, booking.dispatched_by, booking.cancelled_by].filter(Boolean) as string[]
  const staffNameById = new Map<string, string>()
  if (staffIds.length > 0) {
    const { data: staffProfiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', [...new Set(staffIds)])
    for (const p of staffProfiles ?? []) staffNameById.set(p.id, `${p.first_name} ${p.last_name}`)
  }
  const createdByName    = booking.created_by    ? staffNameById.get(booking.created_by)    ?? null : null
  const dispatchedByName = booking.dispatched_by  ? staffNameById.get(booking.dispatched_by) ?? null : null
  const cancelledByName  = booking.cancelled_by   ? staffNameById.get(booking.cancelled_by)  ?? null : null

  // Nombres de los actores de la bitácora de eventos (además de driver/customer/system)
  const eventActorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter(Boolean))] as string[]
  const eventActorNameById = new Map<string, string>()
  if (eventActorIds.length > 0) {
    const { data: actorProfiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', eventActorIds)
    for (const p of actorProfiles ?? []) eventActorNameById.set(p.id, `${p.first_name} ${p.last_name}`)
  }

  const pickup  = parseLocation(booking.pickup_location)
  const dropoff = parseLocation(booking.dropoff_location)
  const isStaff = user.role !== 'accounting'

  // ── Sección G — Red de afiliados ──────────────────────────────────────────
  const affiliatesDict = getDict().affiliates
  const [{ data: companyRow }, { data: relations }, { data: existingTrips }] = await Promise.all([
    admin.from('companies').select('affiliate_network_enabled').eq('id', companyId).single(),
    admin
      .from('company_affiliates')
      .select('id, requester_company_id, affiliate_company_id')
      .eq('status', 'approved')
      .or(`requester_company_id.eq.${companyId},affiliate_company_id.eq.${companyId}`),
    admin
      .from('affiliate_trips')
      .select('id, company_affiliate_id, status, offered_price, countered_price, agreed_price, margin_amount, affiliate_company_id')
      .eq('booking_id', booking.id)
      .in('status', ['requested', 'accepted', 'rejected', 'countered', 'expired', 'cancelled', 'lost', 'en_route', 'arrived', 'in_progress', 'completed'])
      .order('created_at', { ascending: false }),
  ])

  const affiliateNetworkEnabled = companyRow?.affiliate_network_enabled ?? false
  const otherCompanyIds = Array.from(new Set((relations ?? []).map((r) =>
    r.requester_company_id === companyId ? r.affiliate_company_id : r.requester_company_id,
  )))
  const { data: otherCompanies } = otherCompanyIds.length
    ? await admin.from('companies').select('id, name').in('id', otherCompanyIds)
    : { data: [] as { id: string; name: string }[] }
  const nameByCompanyId = new Map((otherCompanies ?? []).map((c) => [c.id, c.name]))

  const affiliateOptions: AffiliateOption[] = (relations ?? []).map((r) => {
    const otherId = r.requester_company_id === companyId ? r.affiliate_company_id : r.requester_company_id
    return { companyAffiliateId: r.id, name: nameByCompanyId.get(otherId) ?? '—' }
  })

  const affiliateTrips: ActiveAffiliateTrip[] = (existingTrips ?? []).map((tr) => ({
    id: tr.id,
    companyAffiliateId: tr.company_affiliate_id,
    status: tr.status,
    affiliateName: nameByCompanyId.get(tr.affiliate_company_id) ?? '—',
    offeredPrice: Number(tr.offered_price),
    counteredPrice: tr.countered_price != null ? Number(tr.countered_price) : null,
    agreedPrice: tr.agreed_price != null ? Number(tr.agreed_price) : null,
    marginAmount: tr.margin_amount != null ? Number(tr.margin_amount) : null,
    currency: booking.currency ?? 'USD',
  }))

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/bookings" className="text-sm text-sl-on-surface-muted hover:text-bronze">
            {t.backToList}
          </Link>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mt-2">
            {booking.booking_number}
          </h1>
          <div className="w-8 h-[3px] bg-gold mt-2 mb-2 rounded-full" />
          <div className="flex items-center gap-3">
            <BookingStatusBadge status={booking.status as BookingStatus} size="md" labels={statusLabels} />
            <span className="text-sm text-sl-on-surface-muted">
              {(t.types as Record<string, string>)[booking.type] ?? booking.type}
            </span>
          </div>
        </div>
        <p className="text-right text-3xl font-playfair font-semibold text-sl-on-surface">
          {booking.total_amount != null
            ? `$${Number(booking.total_amount).toFixed(2)}`
            : '—'}
          <span className="text-sm font-sans font-normal text-sl-on-surface-muted ml-1">
            {booking.currency ?? 'USD'}
          </span>
        </p>
      </div>

      {/* Acciones de estado + asignación */}
      {isStaff && (
        <BookingActions
          bookingId={booking.id}
          currentStatus={booking.status as BookingStatus}
          driverId={booking.driver_id ?? null}
          drivers={drivers ?? []}
          labels={getDict().admin.bookingActions}
        />
      )}

      {/* Pipeline: link público de la cotización para enviar al cliente */}
      {isStaff && booking.status === 'quote' && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.quoteLinkTitle}</p>
          <p className="text-xs text-sl-on-surface-muted mt-1 mb-3">{t.quoteLinkHint}</p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="flex-1 min-w-[220px] text-xs font-mono text-bronze bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 truncate">
              {`${getAppUrl()}/quote/${booking.id}`.replace(/^https?:\/\//, '')}
            </code>
            <CopyButton text={`${getAppUrl()}/quote/${booking.id}`} label={t.copyLink} copiedLabel={t.copiedLink} light />
          </div>
        </div>
      )}

      {/* Detalles de la ruta */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          {t.routeTitle}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-sl-on-surface-muted mb-1">{t.pickup}</p>
            <p className="text-sm font-medium text-sl-on-surface">{pickup.address ?? '—'}</p>
            {pickup.notes && <p className="text-xs text-sl-on-surface-muted mt-0.5">{pickup.notes}</p>}
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted mb-1">{t.dropoff}</p>
            <p className="text-sm font-medium text-sl-on-surface">{dropoff.address ?? '—'}</p>
            {dropoff.notes && <p className="text-xs text-sl-on-surface-muted mt-0.5">{dropoff.notes}</p>}
          </div>
        </div>
        {Array.isArray(booking.waypoints) && booking.waypoints.length > 0 && (
          <div className="pt-2 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted mb-1">
              {t.waypoints.replace('{n}', String(booking.waypoints.length))}
            </p>
            {booking.waypoints.map((w, i) => {
              const stop = parseLocation(w)
              return (
                <p key={i} className="text-sm text-sl-on-surface">
                  <span className="text-bronze font-medium">{i + 1}.</span> {stop.address ?? '—'}
                </p>
              )
            })}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-sl-outline-variant">
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.dateTime}</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{fmt(booking.scheduled_at, localeTag)}</p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.distance}</p>
            <p className="text-sm text-sl-on-surface mt-0.5">
              {booking.distance_miles != null ? `${Number(booking.distance_miles).toFixed(1)} mi` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.durationEst}</p>
            <p className="text-sm text-sl-on-surface mt-0.5">
              {booking.duration_minutes != null ? `${booking.duration_minutes} min` : '—'}
            </p>
          </div>
        </div>
        {booking.flight_number && (
          <div className="pt-2 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted">{t.flight}</p>
            <p className="text-sm font-mono text-sl-on-surface mt-0.5">
              ✈ {booking.flight_number}
              {booking.flight_status === 'cancelled' && (
                <span className="ml-2 font-sans font-semibold text-red-500">{t.flightCancelled}</span>
              )}
              {booking.flight_status !== 'cancelled' && (booking.flight_delay_minutes ?? 0) >= 15 && (
                <span className="ml-2 font-sans font-semibold text-orange-500">
                  {t.flightDelay.replace('{min}', String(booking.flight_delay_minutes))}
                </span>
              )}
              {booking.flight_status === 'arrived' && (
                <span className="ml-2 font-sans text-green-600">{t.flightArrived}</span>
              )}
              {booking.flight_status === 'enroute' && (
                <span className="ml-2 font-sans text-sl-on-surface-muted">{t.flightEnroute}</span>
              )}
            </p>
            {booking.flight_arrival_at && (
              <p className="text-xs text-sl-on-surface-muted mt-1">
                {t.flightEta}: {fmt(booking.flight_arrival_at, localeTag)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pasajero */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          {t.passengerTitle}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.name}</p>
            <p className="text-sm font-medium text-sl-on-surface mt-0.5">{booking.passenger_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.passengers}</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{booking.passenger_count}</p>
          </div>
          {booking.passenger_phone && (
            <div>
              <p className="text-xs text-sl-on-surface-muted">{t.phone}</p>
              <p className="text-sm text-sl-on-surface mt-0.5">{booking.passenger_phone}</p>
            </div>
          )}
          {booking.passenger_email && (
            <div>
              <p className="text-xs text-sl-on-surface-muted">{t.email}</p>
              <p className="text-sm text-sl-on-surface mt-0.5">{booking.passenger_email}</p>
            </div>
          )}
        </div>
        {booking.meet_and_greet && (
          <p className="inline-flex text-xs font-medium text-bronze bg-gold/10 border border-bronze/20 rounded-lg px-3 py-1.5">
            {t.meetAndGreet}
          </p>
        )}
        {booking.special_instructions && (
          <div className="pt-3 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted mb-1">{t.specialInstructions}</p>
            <p className="text-sm text-sl-on-surface">{booking.special_instructions}</p>
          </div>
        )}
      </div>

      {/* Vehículo + conductor */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          {t.vehicleDriverTitle}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.vehicleType}</p>
            <p className="text-sm text-sl-on-surface mt-0.5">
              {vehicleType ? `${vehicleType.name} (${vehicleType.capacity} ${t.pax})` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-sl-on-surface-muted">{t.driver}</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{driverName}</p>
          </div>
          {assignedVehicle && (
            <div>
              <p className="text-xs text-sl-on-surface-muted">{t.assignedVehicle}</p>
              <p className="text-sm text-sl-on-surface mt-0.5">
                {assignedVehicle.make} {assignedVehicle.model} · {assignedVehicle.plate_number}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sección G — Red de afiliados */}
      {isStaff && (
        <SendToAffiliateCard
          bookingId={booking.id}
          enabled={affiliateNetworkEnabled}
          affiliates={affiliateOptions}
          trips={affiliateTrips}
          myCompanyId={companyId}
          t={affiliatesDict}
        />
      )}

      {/* Fees */}
      {fees && fees.length > 0 && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
            {t.feesTitle}
          </p>
          <div className="space-y-2">
            {fees.map((fee) => (
              <div key={fee.id} className="flex justify-between text-sm">
                <span className="text-sl-on-surface-muted capitalize">
                  {fee.description ?? fee.type}
                </span>
                <span className="text-sl-on-surface font-medium">
                  ${Number(fee.amount).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-sl-outline-variant pt-2 mt-2">
              <span className="text-sl-on-surface">{t.total}</span>
              <span className="text-sl-on-surface">
                ${Number(booking.total_amount ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Pagos */}
      <BookingPayments
        bookingId={booking.id}
        payments={payments ?? []}
        stripeConfigured={isStripeConfigured() || isWhopConnectConfigured()}
        canRefund={['company_owner', 'company_admin', 'accounting'].includes(user.role)}
        bookingTotal={booking.total_amount}
      />

      {/* Timestamps */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
          {t.timelineTitle}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: t.ts.created,    value: booking.created_at,    by: createdByName },
            { label: t.ts.assigned,   value: booking.dispatched_at, by: dispatchedByName },
            { label: t.ts.en_route,   value: booking.en_route_at,   by: null },
            { label: t.ts.arrived,    value: booking.arrived_at,    by: null },
            { label: t.ts.started,    value: booking.started_at,    by: null },
            { label: t.ts.completed,  value: booking.completed_at,  by: null },
            { label: t.ts.cancelled,  value: booking.cancelled_at,  by: cancelledByName },
            { label: t.ts.no_show,    value: booking.no_show_at,    by: null },
          ].filter((row) => row.value).map((row) => (
            <div key={row.label}>
              <p className="text-xs text-sl-on-surface-muted">{row.label}</p>
              <p className="text-sl-on-surface">{fmt(row.value ?? null, localeTag)}</p>
              {row.by && (
                <p className="text-[11px] text-sl-on-surface-muted mt-0.5">{t.by} {row.by}</p>
              )}
            </div>
          ))}
        </div>
        {booking.cancellation_reason && (
          <div className="mt-3 pt-3 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted">{t.cancellationReason}</p>
            <p className="text-sm text-sl-on-surface mt-0.5">{booking.cancellation_reason}</p>
          </div>
        )}
      </div>

      {/* Bitácora de eventos: rechazos, incidentes, reasignaciones */}
      {!!events?.length && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
            {t.eventsTitle}
          </p>
          <div className="space-y-3">
            {events.map((ev) => {
              const isIncident = ev.type === 'driver_incident'
              const category = (ev.metadata as { category?: string } | null)?.category
              const actorName = ev.actor_id ? eventActorNameById.get(ev.actor_id) : null
              return (
                <div
                  key={ev.id}
                  className={`rounded-xl border p-3.5 ${isIncident ? 'border-amber-200 bg-amber-50' : 'border-sl-outline-variant bg-sl-bg'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold ${isIncident ? 'text-amber-800' : 'text-sl-on-surface'}`}>
                      {t.eventTypes[ev.type as keyof typeof t.eventTypes] ?? ev.type}
                      {category && ` | ${t.incidentCategories[category as keyof typeof t.incidentCategories] ?? category}`}
                    </span>
                    <span className="text-[11px] text-sl-on-surface-muted">{fmt(ev.created_at, localeTag)}</span>
                  </div>
                  {ev.reason && (
                    <p className="text-sm text-sl-on-surface mt-1.5">{ev.reason}</p>
                  )}
                  <p className="text-[11px] text-sl-on-surface-muted mt-1.5">
                    {actorName ?? (t.eventActors[ev.actor as keyof typeof t.eventActors] ?? ev.actor)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Calificación del cliente (review post-viaje) */}
      {booking.rating != null && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.ratingTitle}
          </p>
          <p className="text-xl text-bronze tracking-[0.15em]">
            {'★'.repeat(booking.rating)}<span className="text-sl-outline-variant">{'★'.repeat(5 - booking.rating)}</span>
          </p>
          {booking.rating_comment && (
            <p className="text-sm text-sl-on-surface mt-2 whitespace-pre-line">{booking.rating_comment}</p>
          )}
        </div>
      )}

      {/* Notas internas */}
      {booking.internal_notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-700 mb-2">
            {t.internalNotesTitle}
          </p>
          <p className="text-sm text-yellow-800">{booking.internal_notes}</p>
        </div>
      )}

    </div>
  )
}
