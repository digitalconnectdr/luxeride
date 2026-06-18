import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { AutoRefresh } from '@/app/track/[id]/auto-refresh'
import { DriverTripActions } from '@/components/driver/trip-actions'
import { DriverAddStop } from '@/components/driver/driver-add-stop'
import { TripChat } from '@/components/trip/trip-chat'
import { CopyButton } from '@/components/trip/copy-button'
import { StaticMap } from '@/components/trip/static-map'

export const metadata: Metadata = { title: 'Portal del conductor' }
export const dynamic = 'force-dynamic'

const STEP_KEYS = ['assigned', 'en_route', 'arrived', 'in_progress', 'completed'] as const
const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

// Construye el mapa estático (pickup A + destino B + ruta) para un viaje.
// Devuelve null si faltan coords o la key (StaticMap se oculta solo si falla).
function buildStaticMap(brand: string, p: { lat?: number; lng?: number } | null, d: { lat?: number; lng?: number } | null, key?: string): { src: string; href: string } | null {
  if (!key || typeof p?.lat !== 'number' || typeof p?.lng !== 'number' || typeof d?.lat !== 'number' || typeof d?.lng !== 'number') return null
  const bc = brand.replace('#', '0x')
  const a = `${p.lat},${p.lng}`
  const b = `${d.lat},${d.lng}`
  const style = [
    'feature:all|element:geometry|color:0x1a1a1d',
    'feature:all|element:labels.text.fill|color:0x9a9a9a',
    'feature:all|element:labels.text.stroke|color:0x131316',
    'feature:road|element:geometry|color:0x2c2c31',
    'feature:water|element:geometry|color:0x0e0e12',
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
  ].map((s) => `&style=${encodeURIComponent(s)}`).join('')
  const src =
    'https://maps.googleapis.com/maps/api/staticmap?size=600x260&scale=2&maptype=roadmap' +
    `&markers=${encodeURIComponent(`size:mid|color:${bc}|label:A|${a}`)}` +
    `&markers=${encodeURIComponent(`size:mid|color:0xffffff|label:B|${b}`)}` +
    `&path=${encodeURIComponent(`color:${bc}cc|weight:3|${a}|${b}`)}` +
    style +
    `&key=${key}`
  return { src, href: `https://www.google.com/maps/dir/?api=1&origin=${a}&destination=${b}` }
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
  const companyName = co?.name ?? brand.name
  const logoUrl = co?.logo_url ?? null
  const dispatchPhone = co?.phone ?? null
  const driverName = user.profile.first_name

  const addStopLabels = { ...dt.addStop, saving: dt.actions.saving }
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapsUrl = (addr: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
  const wazeUrl = (addr: string) => `https://www.waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-[#1d1b18] antialiased">
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
            <p className="text-[11px] text-green-600 flex items-center gap-1.5 justify-end">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {dt.onDuty}
            </p>
          </div>
          <LanguageSwitcher current={locale} variant="light" />
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-[#75716a] hover:text-red-500 transition-colors">{dt.signOut} →</button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">
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
            const mp = buildStaticMap(brandColor, pLoc, dLoc, mapsKey)
            const currentIdx = STEP_KEYS.findIndex((k) => k === t.status)
            const name = t.passenger_name ?? dt.passenger
            const waNumber = (t.passenger_phone ?? '').replace(/[^0-9]/g, '')
            const chatId = `chat-${t.id}`
            const stKey = t.status as 'assigned' | 'en_route' | 'arrived' | 'in_progress'

            return (
              <article key={t.id} className={`${card} p-5 sm:p-6`} style={{ ['--brand' as string]: brandColor }}>
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
                    {/* Mapa del viaje (pickup A → destino B) */}
                    {mp && (
                      <StaticMap src={mp.src} href={mp.href} alt={dt.route} openLabel={dt.openInMaps} light />
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
                      {/* Agregar parada — dentro de la ruta */}
                      <div className="pt-2 border-t border-[#f0ede5]">
                        <DriverAddStop bookingId={t.id} labels={addStopLabels} />
                      </div>
                    </div>

                    {/* Pasajero */}
                    <div className="rounded-2xl border border-[#e5e1d8] bg-white p-5">
                      <p className={`${sectionLabel} mb-3`}>{dt.passenger}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[#1d1b18] font-bold ring-1 ring-[#e5e1d8]" style={{ backgroundColor: brandColor }}>
                          {(t.passenger_name ?? 'P').trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-[#1d1b18]">{t.passenger_name ?? dt.passenger}</p>
                          {t.passenger_phone && <p className="text-sm text-[#75716a]">{t.passenger_phone}</p>}
                        </div>
                      </div>
                      {t.passenger_phone && (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <a href={`tel:${t.passenger_phone}`} className="text-center text-xs font-medium rounded-lg border border-[#e5e1d8] py-2 hover:bg-[#faf8f3] transition-colors">📞 {dt.call}</a>
                          {waNumber && (
                            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="text-center text-xs font-medium rounded-lg border border-[#e5e1d8] py-2 hover:bg-[#faf8f3] transition-colors text-green-600">WhatsApp</a>
                          )}
                          <a href={`#${chatId}`} className="text-center text-xs font-medium rounded-lg border border-[#e5e1d8] py-2 hover:bg-[#faf8f3] transition-colors">💬 {dt.message}</a>
                        </div>
                      )}
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

        <p className="text-xs text-center text-[#a8a39a] pt-4">{dt.mobileSoon}</p>
      </main>
    </div>
  )
}
