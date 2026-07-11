'use client'
// ── Mapa en vivo REALMENTE dinámico (API JS de Google, con pan/zoom real) ─────
// Reemplaza al viejo LiveTrackingMap (una imagen Static Maps que se recargaba
// entera cada ~15s). Aquí el mapa se carga UNA vez y solo se reposicionan los
// marcadores — igual que el mapa del Dispatch Board (ver dispatch-live-map.tsx).
//
// Cuota: la API JS de Google se cobra por "map load" (una vez por sesión), no
// por cada reposición de marcador — así que activamos 1 unidad de cuota al
// montar (activateLiveMapSessionAction) y luego sondeamos posiciones gratis
// (getLiveTripPositionsAction, solo lectura de Supabase, sin costo de Google).
// Si la cuota mensual del plan ya se agotó, se degrada al mapa estático
// congelado (initialSrc) — nunca se bloquea la página.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { createClient } from '@/lib/supabase/client'
import { activateLiveMapSessionAction, getLiveTripPositionsAction, reportPassengerLocationAction } from '@/app/actions/live-tracking'
import { StaticMap } from '@/components/trip/static-map'
import { MapsProvider } from '@/components/maps/maps-provider'
import { APPLE_WHITE_MAP_STYLES, APPLE_DARK_MAP_STYLES } from '@/lib/maps/config'
import type { LatLng } from '@/lib/tracking/static-map-url'

const REFRESH_INTERVAL_MS = 15_000
const STALE_AFTER_MS = 50_000
const FIT_BOUNDS_PADDING = 48
const GLIDE_MS = 1_100

function markerIcon(color: string, letter: string, textColor = '#ffffff'): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="12.5" fill="${color}" stroke="#ffffff" stroke-width="2.5"/><text x="15" y="19.5" font-size="11" font-weight="700" text-anchor="middle" fill="${textColor}" font-family="system-ui,sans-serif">${letter}</text></svg>`
  return { url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(30, 30) }
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/** Anima suavemente el marcador del conductor entre su última posición y la
 *  nueva (en vez de teletransportarlo) — es el detalle que hace que el mapa
 *  se sienta "vivo" en vez de solo refrescado. */
function useGlidingPosition(target: LatLng | null): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(target)
  const fromRef = useRef<LatLng | null>(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!target) { setPos(null); fromRef.current = null; return }
    const from = fromRef.current ?? target
    if (from.lat === target.lat && from.lng === target.lng) { setPos(target); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / GLIDE_MS)
      const e = easeOutCubic(t)
      setPos({ lat: from.lat + (target.lat - from.lat) * e, lng: from.lng + (target.lng - from.lng) * e })
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng])

  return pos
}

function RoutePolylineLayer({ encoded, color, fallback }: { encoded?: string | null; color: string; fallback: LatLng[] }) {
  const map = useMap()
  const geometryLib = useMapsLibrary('geometry')
  const polylineRef = useRef<google.maps.Polyline | null>(null)

  useEffect(() => {
    if (!map) return
    let path: google.maps.LatLng[] | google.maps.LatLngLiteral[] = fallback
    if (encoded && geometryLib) {
      try { path = geometryLib.encoding.decodePath(encoded) } catch { path = fallback }
    }
    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({ path, strokeColor: color, strokeWeight: 4, strokeOpacity: 0.85 })
      polylineRef.current.setMap(map)
    } else {
      polylineRef.current.setPath(path)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geometryLib, encoded, color])

  useEffect(() => () => { polylineRef.current?.setMap(null); polylineRef.current = null }, [])

  return null
}

function FitToTrip({ pickup, dropoff, driverPos }: { pickup: LatLng; dropoff: LatLng; driverPos: LatLng | null }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (!map || fittedRef.current) return
    fittedRef.current = true
    const bounds = new google.maps.LatLngBounds()
    bounds.extend(pickup)
    bounds.extend(dropoff)
    if (driverPos) bounds.extend(driverPos)
    map.fitBounds(bounds, FIT_BOUNDS_PADDING)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  return null
}

export interface InteractiveLiveMapProps {
  bookingId: string
  pickup: LatLng
  dropoff: LatLng
  routePolyline?: string | null
  brandColor: string
  href: string
  alt: string
  openLabel: string
  /** Mapa estático de respaldo — se usa si la cuota está agotada o falla la API JS. */
  fallbackSrc: string
  light?: boolean
  allowPassengerShare?: boolean
  showPausedBanner?: boolean
  labels: {
    paused: string
    pausedDesc: string
    shareOff?: string
    sharing?: string
  }
}

export function InteractiveLiveMap({
  bookingId,
  pickup,
  dropoff,
  routePolyline,
  brandColor,
  href,
  alt,
  openLabel,
  fallbackSrc,
  light = false,
  allowPassengerShare = false,
  showPausedBanner = true,
  labels,
}: InteractiveLiveMapProps) {
  const [phase, setPhase] = useState<'checking' | 'live' | 'static'>('checking')
  const activatedRef = useRef(false)
  const [driverPos, setDriverPos] = useState<LatLng | null>(null)
  const [passengerPos, setPassengerPos] = useState<LatLng | null>(null)
  const [paused, setPaused] = useState(false)
  const [sharing, setSharing] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  // ── Activar la sesión UNA vez (consume 1 unidad de cuota, no por sondeo) ──
  useEffect(() => {
    if (activatedRef.current) return
    activatedRef.current = true
    activateLiveMapSessionAction(bookingId).then((res) => setPhase(res?.allowed ? 'live' : 'static'))
  }, [bookingId])

  // Si la API JS rechaza la key en este dominio, cae al mapa estático.
  useEffect(() => {
    const handler = () => setPhase('static')
    window.addEventListener('luxeride:gm-auth-failure', handler)
    return () => window.removeEventListener('luxeride:gm-auth-failure', handler)
  }, [])

  const refresh = useCallback(async () => {
    const res = await getLiveTripPositionsAction(bookingId)
    if (!res) return
    setDriverPos(res.driverPos)
    setPassengerPos(res.passengerPos)
    const recordedAt = res.driverRecordedAt ? new Date(res.driverRecordedAt).getTime() : null
    setPaused(recordedAt === null || Date.now() - recordedAt > STALE_AFTER_MS)
  }, [bookingId])

  useEffect(() => {
    if (phase !== 'live') return
    refresh()
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [phase, refresh])

  // Realtime: acelera el refresco cuando la sesión SÍ tiene acceso de lectura
  // (conductor). El pasajero (sin sesión) simplemente no recibe eventos y el
  // polling de arriba sigue funcionando igual.
  useEffect(() => {
    if (phase !== 'live') return
    const supabase = createClient()
    const channel = supabase
      .channel(`trip-location-${bookingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_locations', filter: `booking_id=eq.${bookingId}` }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [phase, bookingId, refresh])

  useEffect(() => {
    if (!allowPassengerShare) setSharing(false)
  }, [allowPassengerShare])

  useEffect(() => {
    if (!sharing || !allowPassengerShare || typeof navigator === 'undefined' || !navigator.geolocation) return
    let lastSentAt = 0
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        if (now - lastSentAt < 10_000) return
        lastSentAt = now
        reportPassengerLocationAction(bookingId, pos.coords.latitude, pos.coords.longitude)
      },
      () => { /* permiso denegado o error de GPS: no interrumpe el resto de la página */ },
      { enableHighAccuracy: true, maximumAge: 8_000 },
    )
    watchIdRef.current = id
    return () => { navigator.geolocation.clearWatch(id) }
  }, [sharing, allowPassengerShare, bookingId])

  const glidingDriverPos = useGlidingPosition(driverPos)

  if (phase === 'checking') {
    return <div className={`rounded-2xl border h-56 animate-pulse ${light ? 'border-[#e5e1d8] bg-[#faf8f3]' : 'border-white/[0.08] bg-white/[0.03]'}`} />
  }

  if (phase === 'static') {
    return <StaticMap src={fallbackSrc} href={href} alt={alt} openLabel={openLabel} light={light} />
  }

  return (
    <div className="space-y-2">
      <div className={`relative rounded-2xl overflow-hidden border h-56 ${light ? 'border-[#e5e1d8]' : 'border-white/[0.08]'}`}>
        <MapsProvider>
          <Map
            defaultCenter={pickup}
            defaultZoom={13}
            styles={light ? APPLE_WHITE_MAP_STYLES : APPLE_DARK_MAP_STYLES}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
          >
            <FitToTrip pickup={pickup} dropoff={dropoff} driverPos={driverPos} />
            <RoutePolylineLayer encoded={routePolyline} color={brandColor} fallback={[pickup, dropoff]} />
            <Marker position={pickup} icon={markerIcon(brandColor, 'A')} title={alt} />
            <Marker position={dropoff} icon={markerIcon('#ffffff', 'B', '#1d1b18')} />
            {glidingDriverPos && <Marker position={glidingDriverPos} icon={markerIcon('#22c55e', 'D')} />}
            {passengerPos && <Marker position={passengerPos} icon={markerIcon('#3b82f6', 'P')} />}
          </Map>
        </MapsProvider>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2.5 right-2.5 text-[10px] font-medium bg-black/55 backdrop-blur px-2.5 py-1 rounded-full text-white/90 hover:bg-black/70 transition-colors"
        >
          {openLabel} ↗
        </a>
      </div>
      {showPausedBanner && paused && (
        <div className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${light ? 'border-[#e5d9b8] bg-[#fdf8ec] text-[#7a5f1a]' : 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300/90'}`}>
          <span className="font-medium">{labels.paused}</span> | {labels.pausedDesc}
        </div>
      )}
      {allowPassengerShare && (
        <button
          type="button"
          onClick={() => setSharing((v) => !v)}
          className={`w-full text-center rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
            light ? 'border-[#e5e1d8] hover:bg-[#faf8f3] text-[#4e4639]' : 'border-white/15 hover:bg-white/10 text-white/80'
          }`}
          style={sharing ? { borderColor: brandColor, color: brandColor } : undefined}
        >
          {sharing ? `● ${labels.sharing}` : labels.shareOff}
        </button>
      )}
    </div>
  )
}
