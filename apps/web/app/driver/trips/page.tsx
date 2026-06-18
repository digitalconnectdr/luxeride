import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'
import { DriverTripActions } from '@/components/driver/trip-actions'
import { DriverAddStop } from '@/components/driver/driver-add-stop'
import { TripChat } from '@/components/trip/trip-chat'
import { CopyButton } from '@/components/trip/copy-button'

export const metadata: Metadata = { title: 'Portal del conductor | LuxeRide' }
export const dynamic = 'force-dynamic'

// Pasos del servicio desde la óptica del conductor (subset de la máquina de estados)
const DRIVER_STEPS = [
  { key: 'assigned',    label: 'Viaje asignado' },
  { key: 'en_route',    label: 'En ruta al pickup' },
  { key: 'arrived',     label: 'Llegó al pickup' },
  { key: 'in_progress', label: 'Viaje en curso' },
  { key: 'completed',   label: 'Viaje completado' },
] as const

const STATUS_TITLE: Record<string, string> = {
  assigned:    'Viaje asignado',
  en_route:    'En ruta al pickup',
  arrived:     'En el punto de recogida',
  in_progress: 'Viaje en curso',
}

function statusSentence(status: string, name: string): string {
  switch (status) {
    case 'assigned':    return `${name} fue asignado a tu servicio. Tu próximo paso: inicia la ruta al punto de recogida.`
    case 'en_route':    return `Vas en camino al punto de recogida de ${name}.`
    case 'arrived':     return `Llegaste al punto de recogida. Espera a ${name} y luego inicia el viaje.`
    case 'in_progress': return `Viaje en curso hacia el destino, con ${name} a bordo.`
    default:            return ''
  }
}

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40'

export default async function DriverTripsPage() {
  const user = await requireRole('driver')
  const admin = createAdminClient()

  const [{ data: trips }, { data: company }] = await Promise.all([
    admin
      .from('bookings')
      .select('id, booking_number, status, passenger_name, passenger_phone, scheduled_at, pickup_location, dropoff_location, waypoints, distance_miles, duration_minutes')
      .eq('driver_id', user.id)
      .in('status', ['assigned', 'en_route', 'arrived', 'in_progress'])
      .order('scheduled_at'),
    user.company_id
      ? admin.from('companies').select('name, logo_url, primary_color, phone').eq('id', user.company_id).single()
      : Promise.resolve({ data: null }),
  ])

  const co = company as { name: string; logo_url: string | null; primary_color: string | null; phone: string | null } | null
  const brandColor = co?.primary_color ?? '#c9a24b'
  const companyName = co?.name ?? 'LuxeRide'
  const logoUrl = co?.logo_url ?? null
  const dispatchPhone = co?.phone ?? null
  const driverName = user.profile.first_name

  const mapsUrl = (addr: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
  const wazeUrl = (addr: string) => `https://www.waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`

  return (
    <div className="min-h-screen bg-[#08080a] text-white antialiased selection:bg-[var(--brand)]/30" style={{ ['--brand' as string]: brandColor }}>
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}55, transparent)` }} />

      {/* ── Header ── */}
      <header className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between gap-4 flex-wrap border-b border-white/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <div className="h-11 w-11 rounded-xl bg-white p-1.5 shadow-sm shadow-black/30 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={companyName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: brandColor }}>
              <span className="text-[#08080a] font-bold text-base leading-none">{companyName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0 border-l border-white/10 pl-3">
            <h1 className="font-playfair text-lg sm:text-xl font-medium tracking-[0.02em] truncate">{companyName}</h1>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mt-0.5">Portal del conductor</p>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <div className="text-right">
            <p className="text-sm font-medium truncate">{driverName}</p>
            <p className="text-[11px] text-green-400 flex items-center gap-1.5 justify-end">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> En servicio
            </p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-white/50 hover:text-red-400 transition-colors">Cerrar sesión →</button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        {!trips?.length ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
            <p className="text-sm text-white/50">No tienes viajes asignados ahora.</p>
          </div>
        ) : (
          trips.map((t) => {
            const pLoc = t.pickup_location as { address?: string } | null
            const dLoc = t.dropoff_location as { address?: string } | null
            const pickup = pLoc?.address ?? '—'
            const dropoff = dLoc?.address ?? '—'
            const currentIdx = DRIVER_STEPS.findIndex((s) => s.key === t.status)
            const name = t.passenger_name ?? 'el pasajero'
            const waNumber = (t.passenger_phone ?? '').replace(/[^0-9]/g, '')
            const chatId = `chat-${t.id}`

            return (
              <article key={t.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
                <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">

                  {/* ── IZQUIERDA: estado + progreso + acción ── */}
                  <div className="space-y-5 lg:sticky lg:top-6 self-start">
                    {/* Estado actual */}
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={sectionLabel}>Estado actual</span>
                        <span className="font-mono text-[11px]" style={{ color: brandColor }}>{t.booking_number}</span>
                      </div>
                      <p className="font-playfair text-xl font-medium">{STATUS_TITLE[t.status] ?? t.status}</p>
                      <p className="text-sm text-white/60 mt-2 leading-relaxed">{statusSentence(t.status, name)}</p>
                      <p className="text-[11px] text-white/40 mt-3 pt-3 border-t border-white/[0.06]">
                        Programado:{' '}
                        <span className="text-white/60">
                          {new Date(t.scheduled_at).toLocaleString('es-DO', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                    </div>

                    {/* Progreso del servicio */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                      <p className={`${sectionLabel} mb-4`}>Progreso del servicio</p>
                      <div className="space-y-0">
                        {DRIVER_STEPS.map((s, i) => {
                          const done = i < currentIdx
                          const current = i === currentIdx
                          return (
                            <div key={s.key} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${done ? 'text-[#08080a]' : current ? 'ring-4 ring-[var(--brand)]/20' : 'bg-white/[0.08] border border-white/15'}`}
                                  style={done || current ? { backgroundColor: brandColor } : undefined}
                                >
                                  {done && <span className="text-[9px] leading-none font-bold">✓</span>}
                                  {current && <span className="h-1.5 w-1.5 rounded-full bg-[#08080a]" />}
                                </div>
                                {i < DRIVER_STEPS.length - 1 && <div className="w-px h-7" style={{ background: done ? brandColor : 'rgba(255,255,255,0.1)' }} />}
                              </div>
                              <p className={`text-sm pb-5 -mt-0.5 ${current ? 'font-semibold text-white' : done ? 'text-white/60' : 'text-white/30'}`}>{s.label}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Acción principal */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                      <p className={`${sectionLabel} mb-3`}>Acción principal</p>
                      <DriverTripActions bookingId={t.id} status={t.status} />
                    </div>
                  </div>

                  {/* ── DERECHA: ruta + pasajero + chat + soporte ── */}
                  <div className="space-y-5">
                    {/* Ruta del viaje */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3 text-sm">
                      <p className={sectionLabel}>Ruta del viaje</p>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-0.5">Pickup</p>
                        <p className="text-white/85">{pickup}</p>
                        {pickup !== '—' && (
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <a href={wazeUrl(pickup)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>Waze ↗</a>
                            <a href={mapsUrl(pickup)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>Google Maps ↗</a>
                            <CopyButton text={pickup} label="Copiar" copiedLabel="✓ Copiado" />
                          </div>
                        )}
                      </div>
                      {Array.isArray(t.waypoints) && t.waypoints.map((w, i) => {
                        const addr = (w as { address?: string } | null)?.address
                        if (!addr) return null
                        return (
                          <div key={i}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-0.5" style={{ color: `${brandColor}aa` }}>◆ Parada {i + 1}</p>
                            <p className="text-white/75">{addr}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <a href={wazeUrl(addr)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>Waze ↗</a>
                              <a href={mapsUrl(addr)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>Google Maps ↗</a>
                            </div>
                          </div>
                        )
                      })}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-0.5">Destino</p>
                        <p className="text-white/85">{dropoff}</p>
                        {dropoff !== '—' && (
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <a href={wazeUrl(dropoff)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>Waze ↗</a>
                            <a href={mapsUrl(dropoff)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium" style={{ color: brandColor }}>Google Maps ↗</a>
                            <CopyButton text={dropoff} label="Copiar" copiedLabel="✓ Copiado" />
                          </div>
                        )}
                      </div>
                      {t.distance_miles != null && t.duration_minutes != null && (
                        <p className="text-[11px] text-white/40 pt-2 border-t border-white/[0.06]">
                          {Number(t.distance_miles).toFixed(1)} mi · {t.duration_minutes} min
                        </p>
                      )}
                      {/* Agregar parada — dentro de la ruta */}
                      <div className="pt-2 border-t border-white/[0.06]">
                        <DriverAddStop bookingId={t.id} />
                      </div>
                    </div>

                    {/* Pasajero */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                      <p className={`${sectionLabel} mb-3`}>Pasajero</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[#08080a] font-bold ring-2 ring-white/10" style={{ backgroundColor: brandColor }}>
                          {(t.passenger_name ?? 'P').trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.passenger_name ?? 'Pasajero'}</p>
                          {t.passenger_phone && <p className="text-sm text-white/50">{t.passenger_phone}</p>}
                        </div>
                      </div>
                      {t.passenger_phone && (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <a href={`tel:${t.passenger_phone}`} className="text-center text-xs font-medium rounded-lg border border-white/15 py-2 hover:bg-white/10 transition-colors">📞 Llamar</a>
                          {waNumber && (
                            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="text-center text-xs font-medium rounded-lg border border-white/15 py-2 hover:bg-white/10 transition-colors text-green-400">WhatsApp</a>
                          )}
                          <a href={`#${chatId}`} className="text-center text-xs font-medium rounded-lg border border-white/15 py-2 hover:bg-white/10 transition-colors">💬 Mensaje</a>
                        </div>
                      )}
                    </div>

                    {/* Mensajes */}
                    <div id={chatId} className="scroll-mt-6">
                      <TripChat
                        bookingId={t.id}
                        side="driver"
                        brandColor={brandColor}
                        quickReplies={['Ya voy en camino', 'Llegué al punto de recogida', 'Por favor confirma tu ubicación', 'Tengo un retraso por tráfico']}
                        labels={{
                          title: 'Mensajes con el pasajero',
                          subtitle: 'Coordina recogida, retrasos o cambios.',
                          placeholder: 'Escribe un mensaje…',
                          send: 'Enviar',
                          empty: 'Sin mensajes todavía.',
                          you: 'Tú',
                          them: t.passenger_name ?? 'Pasajero',
                        }}
                      />
                    </div>

                    {/* Soporte */}
                    {dispatchPhone && (
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                        <p className={`${sectionLabel} mb-3`}>Soporte</p>
                        <a href={`tel:${dispatchPhone}`} className="inline-flex items-center gap-2 text-sm font-medium rounded-lg border border-white/15 px-4 py-2 hover:bg-white/10 transition-colors">
                          ☎ Contactar a dispatch
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })
        )}

        <p className="text-xs text-center text-white/30 pt-4">La app móvil para conductores llega en la Fase 2.</p>
      </main>
    </div>
  )
}
