import type { Metadata } from 'next'
import { requireRole, getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { ServiceWorkerRegister } from '@/components/pwa/sw-register'
import { logoutAction } from '@/app/actions/auth'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { AutoRefresh } from '@/app/track/[id]/auto-refresh'
import { DriverTripActions } from '@/components/driver/trip-actions'
import { DriverAddStop } from '@/components/driver/driver-add-stop'
import { DriverAddCharge } from '@/components/driver/driver-add-charge'
import { parseExtraFees } from '@/lib/policy/engine'
import { TripChat } from '@/components/trip/trip-chat'
import { PassengerContact } from '@/components/driver/passenger-contact'
import { CopyButton } from '@/components/trip/copy-button'
import { InteractiveLiveMap } from '@/components/trip/interactive-live-map'
import { LiveLocationReporter } from '@/components/driver/live-location-reporter'
import { MapsProvider } from '@/components/maps/maps-provider'
import { AffiliateTripCard, type AffiliateTripForDriver } from '@/components/driver/affiliate-trip-card'
import { DriverRateForm } from '@/components/driver/driver-rate-form'
import { buildTripStaticMapUrl, tripDirectionsHref } from '@/lib/tracking/static-map-url'
import { DriverSelfAvailabilityToggle } from '@/components/driver/availability-toggle'
import { DriverChannelChat } from '@/components/shared/driver-channel-chat'
import { ShareMenu } from '@/components/share/share-menu'
import { getAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

// PWA del conductor: manifest branded por empresa (arranca en /driver/trips).
export async function generateMetadata(): Promise<Metadata> {
  const meta: Metadata = { title: 'Portal del conductor' }
  try {
    const u = await getCurrentUser()
    if (u?.company_id) {
      const admin = createAdminClient()
      const { data: c } = await admin.from('companies').select('slug, logo_url').eq('id', u.company_id).single()
      if (c?.slug) {
        meta.manifest = `/manifest/driver/${c.slug}`
        meta.appleWebApp = { capable: true, statusBarStyle: 'default', title: 'Conductor' }
        if (c.logo_url) meta.icons = { icon: [{ url: c.logo_url }], apple: [{ url: c.logo_url }] }
      }
    }
  } catch { /* sin sesión → manifest genérico */ }
  return meta
}

const STEP_KEYS = ['assigned', 'en_route', 'arrived', 'in_progress', 'completed'] as const
const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }
const ACTIVE_STATUSES = new Set(['assigned', 'en_route', 'arrived', 'in_progress'])

// Construye el mapa estático (pickup A + destino B + ruta real) para un viaje.
// Devuelve null si faltan coords o la key (StaticMap se oculta solo si falla).
function buildStaticMap(
  brand: string,
  p: { lat?: number; lng?: number } | null,
  d: { lat?: number; lng?: number } | null,
  key?: string,
  routePolyline?: string | null,
): { src: string; href: string } | null {
  if (!key || typeof p?.lat !== 'number' || typeof p?.lng !== 'number' || typeof d?.lat !== 'number' || typeof d?.lng !== 'number') return null
  const pickup = { lat: p.lat, lng: p.lng }
  const dropoff = { lat: d.lat, lng: d.lng }
  return {
    src: buildTripStaticMapUrl({ pickup, dropoff, brandColor: brand, mapsKey: key, routePolyline, size: '600x260' }),
    href: tripDirectionsHref(pickup, dropoff),
  }
}

// Tema claro "Ivory" (igual que el panel admin) — diferencia la vista del
// conductor (interna) de la del pasajero (dark premium).
const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.22em] text-[#75716a]'
const card = 'rounded-2xl border border-[#e5e1d8] bg-white'
const navLink = 'text-[11px] font-medium text-[#0071e3] hover:underline'

export default async function DriverTripsPage() {
  const user = await requireRole('driver')
  const admin = createAdminClient()
  const locale = getLocale()
  const dt = getDict(locale).driver
  const localeTag = LOCALE_TAGS[locale] ?? 'es-DO'

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [{ data: trips }, { data: company }, { data: unratedTrips }, { data: driverRow }, { data: recentCompleted }, { data: affiliateTripsRaw }] = await Promise.all([
    admin
      .from('bookings')
      .select('id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, waypoints, distance_miles, duration_minutes, vehicle_id, route_polyline, meet_and_greet')
      .eq('driver_id', user.id)
      .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
      .order('scheduled_at'),
    user.company_id
      ? admin.from('companies').select('name, slug, logo_url, primary_color, phone, currency, settings').eq('id', user.company_id).single()
      : Promise.resolve({ data: null }),
    admin
      .from('bookings')
      .select('id, booking_number, passenger_name, completed_at')
      .eq('driver_id', user.id)
      .eq('status', 'completed')
      .is('driver_rated_at', null)
      .gte('completed_at', sevenDaysAgo)
      .order('completed_at', { ascending: false })
      .limit(10),
    admin.from('drivers').select('is_available, current_vehicle_id').eq('id', user.id).maybeSingle(),
    // Historial: TODOS los viajes completados de los últimos 7 días (calificados
    // o no), con detalle completo — distinto de `unratedTrips` (solo pendientes
    // de calificar, sin ruta/precio, usado para la tarjeta de calificación).
    admin
      .from('bookings')
      .select('id, booking_number, passenger_name, scheduled_at, completed_at, pickup_location, dropoff_location, distance_miles, duration_minutes, total_amount, currency, vehicle_id')
      .eq('driver_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', sevenDaysAgo)
      .order('completed_at', { ascending: false })
      .limit(50),
    // Sección G — viajes de otras empresas (afiliadas) asignados a este conductor.
    // Nunca se tocan bookings.driver_id/status para estos — viven aparte en
    // affiliate_trips (ver docs/PENDING.md sección G).
    admin
      .from('affiliate_trips')
      .select('id, booking_id, owner_company_id, status')
      .eq('driver_id', user.id)
      .in('status', ['accepted', 'en_route', 'arrived', 'in_progress'])
      .order('created_at'),
  ])
  const isAvailable = driverRow?.is_available ?? false

  // Detalle completo del booking original + nombre de la empresa dueña, solo
  // para los viajes afiliados que este conductor ya tiene asignados.
  const affiliateBookingIds = Array.from(new Set((affiliateTripsRaw ?? []).map((t) => t.booking_id)))
  const affiliateOwnerIds = Array.from(new Set((affiliateTripsRaw ?? []).map((t) => t.owner_company_id)))
  const [{ data: affiliateBookings }, { data: affiliateOwners }] = await Promise.all([
    affiliateBookingIds.length
      ? admin.from('bookings').select('id, pickup_location, dropoff_location, scheduled_at').in('id', affiliateBookingIds)
      : Promise.resolve({ data: [] as { id: string; pickup_location: unknown; dropoff_location: unknown; scheduled_at: string }[] }),
    affiliateOwnerIds.length
      ? admin.from('companies').select('id, name').in('id', affiliateOwnerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const bookingById = new Map((affiliateBookings ?? []).map((b) => [b.id, b]))
  const ownerNameById = new Map((affiliateOwners ?? []).map((c) => [c.id, c.name]))
  const affiliateTrips: AffiliateTripForDriver[] = (affiliateTripsRaw ?? []).map((t) => {
    const b = bookingById.get(t.booking_id)
    const pLoc = b?.pickup_location as { address?: string } | null
    const dLoc = b?.dropoff_location as { address?: string } | null
    return {
      id: t.id,
      status: t.status,
      ownerCompanyName: ownerNameById.get(t.owner_company_id) ?? '—',
      pickupAddress: pLoc?.address ?? '—',
      dropoffAddress: dLoc?.address ?? '—',
      scheduledAt: b?.scheduled_at ?? new Date().toISOString(),
    }
  })
  const affiliatesDict = getDict(locale).affiliates

  // Vehículo con el que dispatch tiene registrado al conductor AHORA MISMO
  // (drivers.current_vehicle_id) — se muestra siempre en el header, no solo
  // dentro de un viaje activo, para que sepa con qué carro lo ve dispatch.
  let assignedVehicle: { plate_number: string | null; typeName: string | null } | null = null
  if (driverRow?.current_vehicle_id) {
    const { data: v } = await admin
      .from('vehicles')
      .select('plate_number, vehicle_type_id')
      .eq('id', driverRow.current_vehicle_id)
      .maybeSingle()
    if (v) {
      let typeName: string | null = null
      if (v.vehicle_type_id) {
        const { data: vt } = await admin.from('vehicle_types').select('name').eq('id', v.vehicle_type_id).maybeSingle()
        typeName = vt?.name ?? null
      }
      assignedVehicle = { plate_number: v.plate_number, typeName }
    }
  }

  const co = company as { name: string; slug: string | null; logo_url: string | null; primary_color: string | null; phone: string | null; currency: string | null; settings: unknown } | null
  const brandColor = co?.primary_color ?? '#c9a24b'
  const companyName = co?.name ?? brand.name
  const logoUrl = co?.logo_url ?? null
  const dispatchPhone = co?.phone ?? null
  const driverName = user.profile.first_name
  const bookingUrl = co?.slug ? `${getAppUrl()}/book/${co.slug}` : null

  const vehicleIds = Array.from(new Set([
    ...(trips ?? []).map((t) => t.vehicle_id),
    ...(recentCompleted ?? []).map((t) => t.vehicle_id),
  ].filter((id): id is string => !!id)))
  const { data: vehiclesData } = vehicleIds.length
    ? await admin.from('vehicles').select('id, color, plate_number, make, model').in('id', vehicleIds)
    : { data: [] as { id: string; color: string | null; plate_number: string | null; make: string; model: string }[] }
  const vehiclesById = new Map((vehiclesData ?? []).map((v) => [v.id, v]))

  const addStopLabels = { ...dt.addStop, saving: dt.actions.saving }
  const extraFees = parseExtraFees(co?.settings)
  const chargeFees = { passenger: extraFees.extra_passenger_fee, luggage: extraFees.extra_luggage_fee }
  const chargeCurrency = co?.currency ?? 'USD'
  const addChargeLabels = { ...dt.addCharge, saving: dt.actions.saving }
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapsUrl = (addr: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
  const wazeUrl = (addr: string) => `https://www.waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`

  return (
    <MapsProvider>
    <div className="min-h-screen bg-[#f6f4ef] text-[#1d1b18] antialiased">
      <ServiceWorkerRegister />
      {/* Auto-refresh mientras hay viajes activos (capta cambios del dispatcher) */}
      {!!trips?.length && <AutoRefresh seconds={15} />}
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)` }} />

      {/* ── Header ── */}
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between gap-4 flex-wrap border-b border-[#e5e1d8]">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <div className="h-11 w-11 rounded-xl bg-white p-1.5 border border-[#e5e1d8] shadow-sm flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={companyName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: brandColor }}>
              <span className="text-[#1d1b18] font-bold text-base leading-none">{companyName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0 border-l border-[#e5e1d8] pl-3">
            <h1 className="font-playfair text-lg sm:text-xl font-semibold tracking-[0.01em] truncate text-[#1d1b18]">{companyName}</h1>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8a6520] mt-0.5">{dt.portal}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <div className="text-right">
            <p className="text-sm font-medium truncate">{driverName}</p>
            <p className="text-[11px] text-[#75716a] mt-0.5">
              {assignedVehicle
                ? `${dt.assignedVehicle}: ${[assignedVehicle.typeName, assignedVehicle.plate_number].filter(Boolean).join(' · ')}`
                : dt.noVehicleAssigned}
            </p>
            <div className="mt-1 flex justify-end">
              <DriverSelfAvailabilityToggle
                isAvailable={isAvailable}
                labels={{ onDuty: dt.onDuty, offDuty: dt.offDuty, saving: dt.actions.saving }}
              />
            </div>
          </div>
          {bookingUrl && (
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline text-[11px] text-[#75716a]">{dt.shareBookingLink}</span>
              <ShareMenu
                url={bookingUrl}
                title={companyName}
                variant="light"
                labels={{ share: dt.share, copyLink: dt.shareCopyLink, copied: dt.copied, instagramHint: dt.shareInstagramHint }}
              />
            </div>
          )}
          <LanguageSwitcher current={locale} variant="light" />
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-[#75716a] hover:text-red-500 transition-colors">{dt.signOut} →</button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        {/* Mensajes de Dispatch — canal general, no atado a un viaje específico */}
        <DriverChannelChat
          variant="driver"
          collapsible
          brandColor={brandColor}
          labels={{
            title: dt.dispatchChat.title,
            placeholder: dt.dispatchChat.placeholder,
            send: dt.dispatchChat.send,
            empty: dt.dispatchChat.empty,
            you: dt.dispatchChat.you,
            them: dt.dispatchChat.them,
            clear: dt.dispatchChat.clear,
            clearConfirm: dt.dispatchChat.clearConfirm,
          }}
        />

        {/* Sección G — viajes de empresas afiliadas asignados a este conductor */}
        {affiliateTrips.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#75716a]">{affiliatesDict.requests.title}</p>
            {affiliateTrips.map((t) => (
              <AffiliateTripCard key={t.id} trip={t} localeTag={localeTag} t={affiliatesDict} />
            ))}
          </div>
        )}

        {!trips?.length ? (
          <div className={`${card} p-12 text-center`}>
            <p className="text-sm text-[#75716a]">{dt.noTrips}</p>
          </div>
        ) : (
          trips.map((t) => {
            const pLoc = t.pickup_location as { address?: string; lat?: number; lng?: number } | null
            const dLoc = t.dropoff_location as { address?: string; lat?: number; lng?: number } | null
            const pickup = pLoc?.address ?? '—'
            const dropoff = dLoc?.address ?? '—'
            const mp = buildStaticMap(brandColor, pLoc, dLoc, mapsKey, t.route_polyline)
            const currentIdx = STEP_KEYS.findIndex((k) => k === t.status)
            const name = t.passenger_name ?? dt.passenger
            const chatId = `chat-${t.id}`
            const stKey = t.status as 'assigned' | 'en_route' | 'arrived' | 'in_progress'
            const vehicle = t.vehicle_id ? vehiclesById.get(t.vehicle_id) : null
            const isActive = ACTIVE_STATUSES.has(t.status)

            return (
              <article key={t.id} className={`${card} p-5 sm:p-6`} style={{ ['--brand' as string]: brandColor }}>
                {isActive && <LiveLocationReporter bookingId={t.id} status={t.status} pauseNotice={dt.locationPauseNotice} />}
                <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">

                  {/* ── IZQUIERDA: estado + progreso + acción ── */}
                  <div className="space-y-5 lg:sticky lg:top-6 self-start">
                    {/* Estado actual */}
                    <div className="rounded-2xl border border-[#e5e1d8] bg-[#faf8f3] border-l-[3px] border-l-[#8a6520] p-5">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={sectionLabel}>{dt.currentStatus}</span>
                        <span className="font-mono text-[11px] text-[#8a6520]">{t.booking_number}</span>
                      </div>
                      <p className="font-playfair text-xl font-semibold text-[#1d1b18]">{dt.statusTitle[stKey] ?? t.status}</p>
                      <p className="text-sm text-[#75716a] mt-2 leading-relaxed">{(dt.sentence[stKey] ?? '').replace('{name}', name)}</p>
                      {t.meet_and_greet && (
                        <p className="inline-flex mt-2 text-xs font-medium text-[#8a6520] bg-[#8a6520]/10 border border-[#8a6520]/20 rounded-lg px-2.5 py-1">
                          {dt.meetAndGreet}
                        </p>
                      )}
                      <p className="text-[11px] text-[#75716a] mt-3 pt-3 border-t border-[#e5e1d8]">
                        {dt.scheduled}:{' '}
                        <span className="text-[#1d1b18] font-medium">
                          {new Date(t.scheduled_at).toLocaleString(localeTag, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                    </div>

                    {/* Progreso del servicio */}
                    <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5">
                      <p className={`${sectionLabel} mb-4`}>{dt.progress}</p>
                      <div className="space-y-0">
                        {STEP_KEYS.map((key, i) => {
                          const done = i < currentIdx
                          const current = i === currentIdx
                          return (
                            <div key={key} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${done ? 'text-[#1d1b18]' : current ? 'ring-4 ring-[var(--brand)]/20' : 'bg-[#f0ede5] border border-[#e5e1d8]'}`}
                                  style={done || current ? { backgroundColor: brandColor } : undefined}
                                >
                                  {done && <span className="text-[9px] leading-none font-bold">✓</span>}
                                  {current && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </div>
                                {i < STEP_KEYS.length - 1 && <div className="w-px h-7" style={{ background: done ? brandColor : '#e5e1d8' }} />}
                              </div>
                              <p className={`text-sm pb-5 -mt-0.5 ${current ? 'font-semibold text-[#1d1b18]' : done ? 'text-[#75716a]' : 'text-[#b5b0a6]'}`}>{dt.steps[i]}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Acción principal */}
                    <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5">
                      <p className={`${sectionLabel} mb-3`}>{dt.mainAction}</p>
                      <DriverTripActions bookingId={t.id} status={t.status} labels={dt.actions} />
                    </div>
                  </div>

                  {/* ── DERECHA: mapa + ruta + pasajero + chat + soporte ── */}
                  <div className="space-y-5">
                    {/* Mapa del viaje (pickup A → destino B) — mapa interactivo real
                        (pan/zoom, marcador del pasajero se desliza en vez de saltar). */}
                    {mp && isActive && (
                      <InteractiveLiveMap
                        bookingId={t.id}
                        pickup={{ lat: pLoc!.lat!, lng: pLoc!.lng! }}
                        dropoff={{ lat: dLoc!.lat!, lng: dLoc!.lng! }}
                        routePolyline={t.route_polyline}
                        brandColor={brandColor}
                        href={mp.href}
                        alt={dt.route}
                        openLabel={dt.openInMaps}
                        fallbackSrc={mp.src}
                        light
                        showPausedBanner={false}
                        labels={dt.liveMap}
                      />
                    )}
                    {/* Ruta del viaje */}
                    <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5 space-y-3 text-sm">
                      <p className={sectionLabel}>{dt.route}</p>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#75716a] mb-0.5">{dt.pickup}</p>
                        <p className="text-[#1d1b18]">{pickup}</p>
                        {pickup !== '—' && (
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <a href={wazeUrl(pickup)} target="_blank" rel="noopener noreferrer" className={navLink}>Waze ↗</a>
                            <a href={mapsUrl(pickup)} target="_blank" rel="noopener noreferrer" className={navLink}>Google Maps ↗</a>
                            <CopyButton text={pickup} label={dt.copy} copiedLabel={dt.copied} light />
                          </div>
                        )}
                      </div>
                      {Array.isArray(t.waypoints) && t.waypoints.map((w, i) => {
                        const addr = (w as { address?: string } | null)?.address
                        if (!addr) return null
                        return (
                          <div key={i}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a6520] mb-0.5">◆ {dt.stop} {i + 1}</p>
                            <p className="text-[#1d1b18]">{addr}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <a href={wazeUrl(addr)} target="_blank" rel="noopener noreferrer" className={navLink}>Waze ↗</a>
                              <a href={mapsUrl(addr)} target="_blank" rel="noopener noreferrer" className={navLink}>Google Maps ↗</a>
                            </div>
                          </div>
                        )
                      })}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#75716a] mb-0.5">{dt.destination}</p>
                        <p className="text-[#1d1b18]">{dropoff}</p>
                        {dropoff !== '—' && (
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <a href={wazeUrl(dropoff)} target="_blank" rel="noopener noreferrer" className={navLink}>Waze ↗</a>
                            <a href={mapsUrl(dropoff)} target="_blank" rel="noopener noreferrer" className={navLink}>Google Maps ↗</a>
                            <CopyButton text={dropoff} label={dt.copy} copiedLabel={dt.copied} light />
                          </div>
                        )}
                      </div>
                      {t.distance_miles != null && t.duration_minutes != null && (
                        <p className="text-[11px] text-[#75716a] pt-2 border-t border-[#f0ede5]">
                          {Number(t.distance_miles).toFixed(1)} mi · {t.duration_minutes} min
                        </p>
                      )}
                      {/* Agregar parada / cargo extra — dentro de la ruta */}
                      <div className="pt-2 border-t border-[#f0ede5] space-y-1">
                        <DriverAddStop bookingId={t.id} labels={addStopLabels} />
                        <DriverAddCharge
                          bookingId={t.id}
                          fees={chargeFees}
                          currency={chargeCurrency}
                          labels={addChargeLabels}
                        />
                      </div>
                    </div>

                    {/* Vehículo asignado (color/placa — visible también al pasajero en tracking) */}
                    {vehicle && (vehicle.color || vehicle.plate_number) && (
                      <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5 flex items-center justify-between gap-4">
                        <div>
                          <p className={sectionLabel}>{dt.vehicle}</p>
                          {vehicle.color && <p className="text-sm text-[#1d1b18] mt-1">{vehicle.color}</p>}
                        </div>
                        {vehicle.plate_number && (
                          <div className="text-right">
                            <p className={sectionLabel}>{dt.plate}</p>
                            <p className="font-mono text-sm mt-1" style={{ color: brandColor }}>{vehicle.plate_number}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pasajero */}
                    <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5">
                      <p className={`${sectionLabel} mb-3`}>{dt.passenger}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[#1d1b18] font-bold ring-1 ring-[#e5e1d8]" style={{ backgroundColor: brandColor }}>
                          {(t.passenger_name ?? 'P').trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-[#1d1b18]">{t.passenger_name ?? dt.passenger}</p>
                        </div>
                      </div>
                      {/* Chat principal + número bajo demanda (auditado) */}
                      <PassengerContact
                        bookingId={t.id}
                        phone={t.passenger_phone ?? null}
                        chatId={chatId}
                        brandColor={brandColor}
                        labels={{ call: dt.call, message: dt.message, showNumber: dt.showNumber }}
                      />
                    </div>

                    {/* Mensajes */}
                    <div id={chatId} className="scroll-mt-6">
                      <TripChat
                        bookingId={t.id}
                        side="driver"
                        theme="light"
                        brandColor={brandColor}
                        quickReplies={dt.chat.quick}
                        labels={{
                          title: dt.chat.title,
                          subtitle: dt.chat.subtitle,
                          placeholder: dt.chat.placeholder,
                          send: dt.chat.send,
                          empty: dt.chat.empty,
                          you: dt.chat.you,
                          them: t.passenger_name ?? dt.passenger,
                          seen: dt.chat.seen,
                        }}
                      />
                    </div>

                    {/* Soporte */}
                    {dispatchPhone && (
                      <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5">
                        <p className={`${sectionLabel} mb-3`}>{dt.support}</p>
                        <a href={`tel:${dispatchPhone}`} className="inline-flex items-center gap-2 text-sm font-medium rounded-lg border border-[#e5e1d8] px-4 py-2 hover:bg-[#faf8f3] transition-colors text-[#1d1b18]">
                          ☎ {dt.contactDispatch}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })
        )}

        {/* Calificar pasajeros de viajes recién completados */}
        {!!unratedTrips?.length && (
          <div className={`${card} p-5 sm:p-6`}>
            <p className="text-sm font-semibold text-[#1d1b18]">{dt.rateForm.sectionTitle}</p>
            <p className="text-xs text-[#75716a] mt-0.5">{dt.rateForm.sectionSubtitle}</p>
            <div className="divide-y divide-[#f0ede5] mt-2">
              {unratedTrips.map((rt) => (
                <DriverRateForm
                  key={rt.id}
                  bookingId={rt.id}
                  bookingNumber={rt.booking_number}
                  passengerName={rt.passenger_name ?? dt.passenger}
                  brandColor={brandColor}
                  labels={dt.rateForm}
                />
              ))}
            </div>
          </div>
        )}

        {/* Historial: viajes completados de los últimos 7 días, con detalle */}
        <div className={`${card} p-5 sm:p-6`}>
          <p className="text-sm font-semibold text-[#1d1b18]">{dt.history.sectionTitle}</p>
          <p className="text-xs text-[#75716a] mt-0.5">{dt.history.sectionSubtitle}</p>
          {!recentCompleted?.length ? (
            <p className="text-xs text-[#a8a39a] mt-4">{dt.history.empty}</p>
          ) : (
            <div className="divide-y divide-[#f0ede5] mt-2">
              {recentCompleted.map((rt) => {
                const pLoc = rt.pickup_location as { address?: string } | null
                const dLoc = rt.dropoff_location as { address?: string } | null
                const v = rt.vehicle_id ? vehiclesById.get(rt.vehicle_id) : null
                const vehicleLabel = v ? [v.make, v.model, v.color].filter(Boolean).join(' ') : null
                return (
                  <div key={rt.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-[#8a6520]">{rt.booking_number}</span>
                        <span className="text-[11px] text-[#a8a39a]">
                          {rt.completed_at
                            ? new Date(rt.completed_at).toLocaleDateString(localeTag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </span>
                      </div>
                      <p className="text-sm text-[#1d1b18] mt-1">{rt.passenger_name ?? dt.passenger}</p>
                      <p className="text-xs text-[#75716a] mt-0.5 truncate max-w-md">
                        {pLoc?.address ?? '—'} → {dLoc?.address ?? '—'}
                      </p>
                      <p className="text-[11px] text-[#a8a39a] mt-1">
                        {rt.distance_miles != null ? `${Number(rt.distance_miles).toFixed(1)} mi` : '—'}
                        {rt.duration_minutes != null ? ` · ${rt.duration_minutes} min` : ''}
                        {vehicleLabel ? ` · ${vehicleLabel}` : ''}
                        {v?.plate_number ? ` · ${v.plate_number}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[#1d1b18] shrink-0">
                      {rt.total_amount != null ? `${Number(rt.total_amount).toFixed(2)} ${rt.currency ?? 'USD'}` : '—'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-center text-[#a8a39a] pt-4">{dt.mobileSoon}</p>
      </main>
    </div>
    </MapsProvider>
  )
}
