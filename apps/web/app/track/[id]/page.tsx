import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { AutoRefresh } from './auto-refresh'
import { TrackActions } from '@/components/trip/track-actions'
import { TripChat } from '@/components/trip/trip-chat'
import { CopyButton } from '@/components/trip/copy-button'
import { StaticMap } from '@/components/trip/static-map'
import { ShareButton } from '@/components/trip/share-button'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).tracking
  return { title: `${t.title} · ${brand.name}` }
}
export const dynamic = 'force-dynamic'

// Página pública de tracking — el UUID del booking actúa como capability URL
// (no adivinable). No expone montos, notas internas ni el teléfono del conductor.
// La comunicación con el conductor se hace por el chat integrado.

const STATUS_KEYS = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed'] as const
const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }
const CANCELLABLE = new Set(['pending', 'assigned', 'en_route', 'arrived'])
const REPORTABLE = new Set(['assigned', 'en_route', 'arrived', 'in_progress', 'completed'])
const ACTIVE = new Set(['assigned', 'en_route', 'arrived', 'in_progress'])

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export default async function TrackPage({ params }: { params: { id: string } }) {
  if (!isValidUuid(params.id)) return notFound()

  const locale = getLocale()
  const t = getDict(locale).tracking
  const localeTag = LOCALE_TAGS[locale] ?? 'en-US'

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, status, scheduled_at, pickup_location, dropoff_location, waypoints, driver_id, vehicle_id, company_id, passenger_name, distance_miles, duration_minutes, dispatched_at, en_route_at, arrived_at, started_at, completed_at')
    .eq('id', params.id)
    .single()

  if (!booking) return notFound()

  const [companyRes, driverRes, vehicleRes] = await Promise.all([
    admin.from('companies').select('name, phone, primary_color, logo_url').eq('id', booking.company_id).single(),
    booking.driver_id
      ? admin.from('user_profiles').select('first_name').eq('id', booking.driver_id).single()
      : Promise.resolve({ data: null }),
    booking.vehicle_id
      ? admin.from('vehicles').select('make, model, color, plate_number').eq('id', booking.vehicle_id).single()
      : Promise.resolve({ data: null }),
  ])

  const company = companyRes.data as { name: string; phone: string | null; primary_color: string | null; logo_url: string | null } | null
  const brandColor = company?.primary_color ?? '#c9a24b'
  const logoUrl = company?.logo_url ?? null
  const companyName = company?.name ?? 'LuxeRide'
  const initial = companyName.trim().charAt(0).toUpperCase() || 'L'
  const driver = driverRes.data as { first_name: string } | null
  const vehicle = vehicleRes.data as { make: string; model: string; color: string | null; plate_number: string } | null

  const pLoc = booking.pickup_location as { address?: string; lat?: number; lng?: number } | null
  const dLoc = booking.dropoff_location as { address?: string; lat?: number; lng?: number } | null
  const pickup  = pLoc?.address ?? '—'
  const dropoff = dLoc?.address ?? '—'

  // Mapa estático elegante (pickup A + destino B + ruta). Se oculta si la
  // "Maps Static API" no está habilitada (StaticMap maneja el onError).
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const haveCoords =
    typeof pLoc?.lat === 'number' && typeof pLoc?.lng === 'number' &&
    typeof dLoc?.lat === 'number' && typeof dLoc?.lng === 'number'
  let mapSrc: string | null = null
  let dirHref = ''
  if (haveCoords && mapsKey) {
    const bc = (company?.primary_color ?? '#c9a24b').replace('#', '0x')
    const p = `${pLoc!.lat},${pLoc!.lng}`
    const d = `${dLoc!.lat},${dLoc!.lng}`
    const style = [
      'feature:all|element:geometry|color:0x1a1a1d',
      'feature:all|element:labels.text.fill|color:0x9a9a9a',
      'feature:all|element:labels.text.stroke|color:0x131316',
      'feature:road|element:geometry|color:0x2c2c31',
      'feature:water|element:geometry|color:0x0e0e12',
      'feature:poi|visibility:off',
      'feature:transit|visibility:off',
    ].map((s) => `&style=${encodeURIComponent(s)}`).join('')
    mapSrc =
      'https://maps.googleapis.com/maps/api/staticmap?size=600x280&scale=2&maptype=roadmap' +
      `&markers=${encodeURIComponent(`size:mid|color:${bc}|label:A|${p}`)}` +
      `&markers=${encodeURIComponent(`size:mid|color:0xffffff|label:B|${d}`)}` +
      `&path=${encodeURIComponent(`color:${bc}cc|weight:3|${p}|${d}`)}` +
      style +
      `&key=${mapsKey}`
    dirHref = `https://www.google.com/maps/dir/?api=1&origin=${p}&destination=${d}`
  }

  const isTerminal = booking.status in t.terminal
  const isCompleted = booking.status === 'completed'
  const currentIdx = STATUS_KEYS.findIndex((k) => k === booking.status)
  const isActive = ACTIVE.has(booking.status)
  // Auto-refresh ESCALONADO por cercanía al viaje, para no saturar el sistema con
  // reservas hechas con días de antelación:
  //   • Viaje en movimiento (en_route/arrived/in_progress) o a ≤2h → cada 15s
  //   • A ≤24h (capta la asignación del conductor el día previo)     → cada 60s
  //   • A más de 24h (reserva lejana, pending/assigned)              → sin polling
  const hoursUntilTrip = (new Date(booking.scheduled_at).getTime() - Date.now()) / 3_600_000
  const inMotion = ['en_route', 'arrived', 'in_progress'].includes(booking.status)
  let pollSeconds = 0
  if (!isTerminal && !isCompleted) {
    if (inMotion || hoursUntilTrip <= 2) pollSeconds = 15
    else if (hoursUntilTrip <= 24) pollSeconds = 60
  }
  const shouldPoll = pollSeconds > 0

  const stampByStatus: Record<string, string | null> = {
    assigned: booking.dispatched_at,
    en_route: booking.en_route_at,
    arrived: booking.arrived_at,
    in_progress: booking.started_at,
    completed: booking.completed_at,
  }
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })

  const currentLabel = isTerminal
    ? t.terminal[booking.status as keyof typeof t.terminal]
    : t.statuses[booking.status as keyof typeof t.statuses]

  // Frase contextual ("Tu chofer te espera…") + progreso ("Paso X de 6")
  const headlineText = (t.headline as Record<string, string>)[booking.status]
    ?.replace('{driver}', driver?.first_name ?? '')
    .trim()
  const progressText = t.progressLabel
    .replace('{n}', String(currentIdx + 1))
    .replace('{total}', String(STATUS_KEYS.length))
  const lastUpdateStamp = stampByStatus[booking.status]
  const scheduledFull = new Date(booking.scheduled_at).toLocaleString(localeTag, {
    weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const mapsUrl = (addr: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`

  const showChat = !!booking.driver_id && !isTerminal
  const canCancel = CANCELLABLE.has(booking.status)
  const canReport = !!booking.driver_id && REPORTABLE.has(booking.status)
  const canAddStop = ACTIVE.has(booking.status)

  const goldRule = `linear-gradient(90deg, transparent, ${brandColor}, transparent)`

  return (
    <div className="min-h-screen bg-[#08080a] text-white antialiased selection:bg-[var(--brand)]/30" style={{ ['--brand' as string]: brandColor }}>
      {shouldPoll && <AutoRefresh seconds={pollSeconds} />}

      {/* Banda dorada superior */}
      <div className="h-px w-full" style={{ background: goldRule }} />

      <div className="max-w-5xl mx-auto px-5 pt-6 pb-12">
        {/* ── Header: barra de marca horizontal con división ── */}
        <header className="flex items-center justify-between gap-x-4 gap-y-3 mb-8 pb-5 border-b border-white/[0.08] flex-wrap">
          {/* Marca: logo (en caja controlada) + nombre + subtítulo */}
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              // Caja premium: tamaño fijo, fondo claro, redondeada → ningún logo rompe el diseño
              <div className="h-11 w-11 rounded-xl bg-white p-1.5 shadow-sm shadow-black/30 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={companyName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-black/30" style={{ backgroundColor: brandColor }}>
                <span className="text-[#08080a] font-bold text-base leading-none">{initial}</span>
              </div>
            )}
            <div className="min-w-0 border-l border-white/10 pl-3">
              <h1 className="font-playfair text-lg sm:text-xl font-semibold tracking-[0.01em] truncate">{companyName}</h1>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mt-0.5">{t.title}</p>
            </div>
          </div>
          {/* Referencia + idioma a la derecha */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5">
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-white/40">{t.bookingRef}</span>
              <span className="font-mono text-xs" style={{ color: brandColor }}>{booking.booking_number}</span>
            </div>
            <LanguageSwitcher current={locale} variant="dark" />
          </div>
        </header>

        {/* Control center dentro de un contenedor: 1 columna en móvil, 2 en desktop */}
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.015] p-4 sm:p-6">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6 items-start">

        {/* ── Columna izquierda: estado + progreso (fija en desktop) ── */}
        <div className="space-y-6 lg:sticky lg:top-6">

        {/* ── Estado actual destacado ── */}
        <div
          className={`relative overflow-hidden rounded-2xl p-6 text-center border ${
            isTerminal
              ? 'border-red-500/25 bg-red-500/[0.07]'
              : isCompleted
                ? 'border-green-500/25 bg-green-500/[0.07]'
                : 'border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent'
          }`}
        >
          {!isTerminal && !isCompleted && (
            <span className="inline-flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: brandColor }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: brandColor }} />
              </span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/45">{t.currentStatus}</span>
            </span>
          )}
          <p className={`font-playfair text-2xl font-medium tracking-[-0.01em] ${isTerminal ? 'text-red-400' : isCompleted ? 'text-green-400' : 'text-white'}`}>
            {isCompleted ? '✓ ' : ''}{currentLabel}
          </p>
          {!isTerminal && headlineText && (
            <p className="text-sm text-white/60 mt-2.5 max-w-xs mx-auto leading-relaxed">{headlineText}</p>
          )}
          {!isTerminal && (
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35 mt-3">{progressText}</p>
          )}
          {!isTerminal && (
            <div className="mt-4 pt-3 border-t border-white/[0.06] text-[11px] text-white/40 space-y-0.5">
              <p>{t.scheduledLabel}: <span className="text-white/60">{scheduledFull}</span></p>
              {lastUpdateStamp && <p>{t.lastUpdate}: <span className="text-white/60">{fmtTime(lastUpdateStamp)}</span></p>}
            </div>
          )}
          {isTerminal && company?.phone && (
            <p className="text-sm text-white/50 mt-3">
              {t.questions} <a href={`tel:${company.phone}`} className="lux-link" style={{ color: brandColor }}>{company.phone}</a>
            </p>
          )}
        </div>

        {/* ── 3. Progreso del viaje ── */}
        {!isTerminal && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
            <div className="space-y-0">
              {STATUS_KEYS.map((key, i) => {
                const done = i < currentIdx
                const current = i === currentIdx
                const stamp = stampByStatus[key]
                return (
                  <div key={key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                          done
                            ? 'text-[#08080a]'
                            : current
                              ? 'ring-4 ring-[var(--brand)]/20'
                              : 'bg-white/[0.08] border border-white/15'
                        }`}
                        style={done || current ? { backgroundColor: brandColor } : undefined}
                      >
                        {done && <span className="text-[10px] leading-none font-bold">✓</span>}
                        {current && <span className="h-1.5 w-1.5 rounded-full bg-[#08080a]" />}
                      </div>
                      {i < STATUS_KEYS.length - 1 && (
                        <div className="w-px h-9" style={{ background: done ? brandColor : 'rgba(255,255,255,0.1)' }} />
                      )}
                    </div>
                    <div className="pb-7 -mt-px">
                      <p className={`text-sm ${current ? 'font-semibold text-white' : done ? 'text-white/70' : 'text-white/30'}`}>
                        {t.statuses[key]}
                      </p>
                      {(done || current) && stamp && (
                        <p className="text-[11px] text-white/35 mt-0.5 font-mono">{fmtTime(stamp)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        </div>{/* fin columna izquierda */}

        {/* ── Columna derecha: ruta + chofer + chat ── */}
        <div className="space-y-6">

        {/* ── 4. Ruta + mapa ── */}
        <section className="space-y-4">
          {mapSrc && !isTerminal && (
            <StaticMap src={mapSrc} href={dirHref} alt={t.mapAlt} openLabel={t.openInMaps} />
          )}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">{t.routeTitle}</p>
            {/* Pickup */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColor }} />
                <span className="w-px flex-1 bg-white/10 my-1" />
              </div>
              <div className="flex-1 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-0.5">{t.pickup}</p>
                <p className="text-white/80">{pickup}</p>
                {pickup !== '—' && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <a href={mapsUrl(pickup)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>{t.openInMaps} ↗</a>
                    <CopyButton text={pickup} label={t.copy} copiedLabel={t.copied} />
                  </div>
                )}
              </div>
            </div>
            {Array.isArray(booking.waypoints) &&
              booking.waypoints.map((w, i) => {
                const addr = (w as { address?: string } | null)?.address
                if (!addr) return null
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className="w-2 h-2 rotate-45" style={{ backgroundColor: `${brandColor}99` }} />
                      <span className="w-px flex-1 bg-white/10 my-1" />
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-0.5" style={{ color: `${brandColor}aa` }}>◆ {i + 1}</p>
                      <p className="text-white/70">{addr}</p>
                    </div>
                  </div>
                )
              })}
            {/* Destino */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-white/60" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-0.5">{t.destination}</p>
                <p className="text-white/80">{dropoff}</p>
                {dropoff !== '—' && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <a href={mapsUrl(dropoff)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>{t.openInMaps} ↗</a>
                    <CopyButton text={dropoff} label={t.copy} copiedLabel={t.copied} />
                  </div>
                )}
              </div>
            </div>
            {booking.distance_miles != null && booking.duration_minutes != null && (
              <p className="text-[11px] text-white/40 pt-3 mt-1 border-t border-white/[0.06]">
                {t.routeEstimate
                  .replace('{miles}', Number(booking.distance_miles).toFixed(1))
                  .replace('{min}', String(booking.duration_minutes))}
              </p>
            )}
            {/* Agregar parada — DENTRO de la tarjeta de ruta (modifica esta ruta) */}
            {canAddStop && (
              <div className="pt-3 border-t border-white/[0.06]">
                <TrackActions
                  bookingId={booking.id}
                  brandColor={brandColor}
                  canCancel={false}
                  canReport={false}
                  canAddStop={true}
                  labels={{ cancel: t.cancel, report: t.report, addStop: t.addStop }}
                />
              </div>
            )}
          </div>
        </section>

        {/* ── 5. Conductor + vehículo ── */}
        {driver && !isTerminal && (
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 mb-4">{t.yourDriver}</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-[#08080a] font-bold ring-2 ring-white/10" style={{ backgroundColor: brandColor }}>
                {driver.first_name.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{driver.first_name}</p>
                <p className="text-[11px] text-white/40">{t.driverRole}</p>
                {vehicle && (
                  <p className="text-sm text-white/50 truncate mt-0.5">
                    {vehicle.color ? `${vehicle.color} ` : ''}{vehicle.make} {vehicle.model}
                  </p>
                )}
              </div>
              {vehicle && (
                <div className="ml-auto text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">{t.plate}</p>
                  <p className="font-mono text-sm" style={{ color: brandColor }}>{vehicle.plate_number}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
              {showChat && (
                <a href="#trip-chat" className="flex-1 text-center rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors">
                  {t.message}
                </a>
              )}
              <ShareButton label={t.shareTrip} copiedLabel={t.shareCopied} brandColor={brandColor} />
            </div>
          </section>
        )}

        {/* ── 6. Mensajes ── */}
        {showChat && (
          <div id="trip-chat" className="scroll-mt-6">
            <TripChat
              bookingId={booking.id}
              side="client"
              brandColor={brandColor}
              quickReplies={t.chat.quick}
              labels={{
                title: t.chat.title,
                subtitle: t.chat.subtitle,
                placeholder: t.chat.placeholder,
                send: t.chat.send,
                empty: t.chat.empty,
                you: t.chat.you,
                them: t.chat.driver,
              }}
            />
          </div>
        )}

        </div>{/* fin columna derecha */}
        </div>{/* fin grid control center */}
        </div>{/* fin contenedor */}

        {/* ── 7. Acciones secundarias (reportar / cancelar) ── */}
        {!isTerminal && (canReport || canCancel) && (
          <div className="mt-6 max-w-md mx-auto">
            <TrackActions
              bookingId={booking.id}
              brandColor={brandColor}
              canCancel={canCancel}
              canReport={canReport}
              canAddStop={false}
              labels={{ cancel: t.cancel, report: t.report, addStop: t.addStop }}
            />
          </div>
        )}

        {/* ── Contacto / footer ── */}
        <div className="mt-8 space-y-2">
          {company?.phone && !isTerminal && (
            <p className="text-center text-xs text-white/40">
              {t.needHelp}{' '}
              <a href={`tel:${company.phone}`} className="lux-link" style={{ color: brandColor }}>{company.phone}</a>
            </p>
          )}
          {shouldPoll && (
            <p className="text-center text-[10px] text-white/25">{t.autoRefresh}</p>
          )}
        </div>
      </div>
    </div>
  )
}
