import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { AutoRefresh } from './auto-refresh'
import { TrackActions } from '@/components/trip/track-actions'
import { TripChat } from '@/components/trip/trip-chat'

export const metadata: Metadata = { title: 'Trip Tracking | LuxeRide' }
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
    .select('id, booking_number, status, scheduled_at, pickup_location, dropoff_location, waypoints, driver_id, vehicle_id, company_id, passenger_name, dispatched_at, en_route_at, arrived_at, started_at, completed_at')
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
  const brandColor = company?.primary_color ?? '#e9c176'
  const logoUrl = company?.logo_url ?? null
  const companyName = company?.name ?? 'LuxeRide'
  const initial = companyName.trim().charAt(0).toUpperCase() || 'L'
  const driver = driverRes.data as { first_name: string } | null
  const vehicle = vehicleRes.data as { make: string; model: string; color: string | null; plate_number: string } | null

  const pickup  = (booking.pickup_location as { address?: string } | null)?.address ?? '—'
  const dropoff = (booking.dropoff_location as { address?: string } | null)?.address ?? '—'

  const isTerminal = booking.status in t.terminal
  const isCompleted = booking.status === 'completed'
  const currentIdx = STATUS_KEYS.findIndex((k) => k === booking.status)
  const isActive = ACTIVE.has(booking.status)

  // Horas por etapa (para el timeline detallado)
  const stampByStatus: Record<string, string | null> = {
    assigned: booking.dispatched_at,
    en_route: booking.en_route_at,
    arrived: booking.arrived_at,
    in_progress: booking.started_at,
    completed: booking.completed_at,
  }
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })

  // Estado actual (encabezado destacado)
  const currentLabel = isTerminal
    ? t.terminal[booking.status as keyof typeof t.terminal]
    : t.statuses[booking.status as keyof typeof t.statuses]

  const showChat = !!booking.driver_id && !isTerminal
  const canCancel = CANCELLABLE.has(booking.status)
  const canReport = !!booking.driver_id && REPORTABLE.has(booking.status)
  const canAddStop = ACTIVE.has(booking.status)

  return (
    <div className="min-h-screen bg-[#0f0e0e] text-white" style={{ ['--brand' as string]: brandColor }}>
      {isActive && <AutoRefresh seconds={30} />}

      <div className="max-w-md mx-auto px-5 py-10 space-y-5">
        {/* ── Header ── */}
        <div className="text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName} className="h-9 max-w-[160px] object-contain mx-auto mb-3" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: brandColor }}>
              <span className="text-gray-900 font-bold text-sm leading-none">{initial}</span>
            </div>
          )}
          <h1 className="font-playfair text-lg font-semibold">{companyName}</h1>
          <div className="inline-flex items-center gap-1.5 mt-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            <span className="text-[10px] uppercase tracking-widest text-white/40">{t.bookingRef}</span>
            <span className="font-mono text-xs text-[var(--brand)]">{booking.booking_number}</span>
          </div>
          <p className="text-xs text-white/40 mt-2">
            {new Date(booking.scheduled_at).toLocaleString(localeTag, {
              weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>

        {/* ── Estado actual destacado ── */}
        <div
          className={`rounded-2xl p-5 text-center border ${
            isTerminal
              ? 'border-red-500/30 bg-red-500/10'
              : isCompleted
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]'
          }`}
        >
          {!isTerminal && !isCompleted && (
            <span className="inline-flex items-center gap-2 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: brandColor }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: brandColor }} />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/40">{t.title}</span>
            </span>
          )}
          <p className={`text-lg font-semibold ${isTerminal ? 'text-red-400' : isCompleted ? 'text-green-400' : 'text-white'}`}>
            {isCompleted ? '✓ ' : ''}{currentLabel}
          </p>
          {isTerminal && company?.phone && (
            <p className="text-sm text-white/50 mt-2">
              {t.questions} <a href={`tel:${company.phone}`} className="text-[var(--brand)]">{company.phone}</a>
            </p>
          )}
        </div>

        {/* ── Timeline (oculto en estados terminales) ── */}
        {!isTerminal && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <div className="space-y-0">
              {STATUS_KEYS.map((key, i) => {
                const done = i < currentIdx
                const current = i === currentIdx
                const stamp = stampByStatus[key]
                return (
                  <div key={key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${
                          done
                            ? 'bg-[var(--brand)]'
                            : current
                              ? 'bg-[var(--brand)] ring-4 ring-[var(--brand)]/20 animate-pulse'
                              : 'bg-white/15'
                        }`}
                      >
                        {done && <span className="text-gray-900 text-[9px] leading-none font-bold">✓</span>}
                      </div>
                      {i < STATUS_KEYS.length - 1 && (
                        <div className={`w-0.5 h-8 ${done ? 'bg-[var(--brand)]' : 'bg-white/10'}`} />
                      )}
                    </div>
                    <div className="pb-6 -mt-0.5">
                      <p className={`text-sm ${current ? 'font-semibold text-white' : done ? 'text-white/60' : 'text-white/30'}`}>
                        {t.statuses[key]}
                      </p>
                      {(done || current) && stamp && (
                        <p className="text-[11px] text-white/30 mt-0.5">{fmtTime(stamp)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Conductor + vehículo ── */}
        {driver && !isTerminal && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
              {t.yourDriver}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-gray-900 font-bold" style={{ backgroundColor: brandColor }}>
                {driver.first_name.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{driver.first_name}</p>
                {vehicle && (
                  <p className="text-sm text-white/50 truncate">
                    {vehicle.color ? `${vehicle.color} ` : ''}{vehicle.make} {vehicle.model}
                  </p>
                )}
              </div>
              {vehicle && (
                <div className="ml-auto text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-widest text-white/30">{t.plate}</p>
                  <p className="font-mono text-sm text-[var(--brand)]">{vehicle.plate_number}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Chat con el conductor ── */}
        {showChat && (
          <TripChat
            bookingId={booking.id}
            side="client"
            brandColor={brandColor}
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
        )}

        {/* ── Ruta ── */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColor }} />
              <span className="w-px flex-1 bg-white/10 my-1" />
            </div>
            <div className="flex-1 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">{t.pickup}</p>
              <p className="text-white/80">{pickup}</p>
            </div>
          </div>
          {Array.isArray(booking.waypoints) &&
            booking.waypoints.map((w, i) => {
              const addr = (w as { address?: string } | null)?.address
              if (!addr) return null
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <span className="w-2 h-2 rotate-45 bg-white/40" />
                    <span className="w-px flex-1 bg-white/10 my-1" />
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--brand)]/60 mb-0.5">◆ {i + 1}</p>
                    <p className="text-white/70">{addr}</p>
                  </div>
                </div>
              )
            })}
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-white/60" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">{t.destination}</p>
              <p className="text-white/80">{dropoff}</p>
            </div>
          </div>
        </div>

        {/* ── Acciones del pasajero ── */}
        {!isTerminal && (
          <TrackActions
            bookingId={booking.id}
            brandColor={brandColor}
            canCancel={canCancel}
            canReport={canReport}
            canAddStop={canAddStop}
            labels={{ cancel: t.cancel, report: t.report, addStop: t.addStop }}
          />
        )}

        {/* ── Contacto / footer ── */}
        {company?.phone && !isTerminal && (
          <p className="text-center text-xs text-white/40">
            {t.needHelp}{' '}
            <a href={`tel:${company.phone}`} className="text-[var(--brand)] hover:underline">{company.phone}</a>
          </p>
        )}
        {isActive && (
          <p className="text-center text-[10px] text-white/25">{t.autoRefresh}</p>
        )}
      </div>
    </div>
  )
}
