'use client'
// ── Mapa en vivo (conductor↔pasajero, solo mientras el viaje está activo) ─────
// Envuelve <StaticMap> y lo mantiene actualizado: se suscribe por Supabase
// Realtime a la posición reportada (ver actions/live-tracking.ts) y, cada
// ~15s, pide una imagen nueva (server action, que también hace cumplir la
// cuota mensual del plan — ver lib/tracking/live-tracking-quota.ts). Si no
// llega ninguna actualización en ~50s con el viaje aún activo, muestra un
// aviso de "vista en pausa" en vez de dejar un mapa congelado sin explicación.

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { refreshLiveMapAction, reportPassengerLocationAction } from '@/app/actions/live-tracking'
import { StaticMap } from '@/components/trip/static-map'

const REFRESH_THROTTLE_MS = 15_000
const STALE_AFTER_MS = 50_000
const STALE_CHECK_MS = 10_000

export function LiveTrackingMap({
  bookingId,
  initialSrc,
  href,
  alt,
  openLabel,
  light = false,
  brandColor,
  allowPassengerShare = false,
  labels,
}: {
  bookingId: string
  initialSrc: string
  href: string
  alt: string
  openLabel: string
  light?: boolean
  brandColor: string
  allowPassengerShare?: boolean
  labels: {
    paused: string
    pausedDesc: string
    shareOff?: string
    sharing?: string
  }
}) {
  const [mapSrc, setMapSrc] = useState(initialSrc)
  const [paused, setPaused] = useState(false)
  const [sharing, setSharing] = useState(false)
  const lastEventAtRef = useRef<number | null>(null)
  const lastRefreshAtRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)

  // Suscripción Realtime a la posición en vivo de este viaje.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`trip-location-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_locations', filter: `booking_id=eq.${bookingId}` },
        () => {
          lastEventAtRef.current = Date.now()
          setPaused(false)
          const now = Date.now()
          if (now - lastRefreshAtRef.current < REFRESH_THROTTLE_MS) return
          lastRefreshAtRef.current = now
          refreshLiveMapAction(bookingId).then((res) => {
            if (res?.url) setMapSrc(res.url)
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [bookingId])

  // Detecta silencio prolongado (conductor salió de la app / perdió señal).
  useEffect(() => {
    const id = setInterval(() => {
      const last = lastEventAtRef.current
      if (last !== null && Date.now() - last > STALE_AFTER_MS) setPaused(true)
    }, STALE_CHECK_MS)
    return () => clearInterval(id)
  }, [])

  // Compartir la ubicación del pasajero (opt-in explícito, nunca automático).
  useEffect(() => {
    if (!sharing || typeof navigator === 'undefined' || !navigator.geolocation) return
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
  }, [sharing, bookingId])

  return (
    <div className="space-y-2">
      <StaticMap src={mapSrc} href={href} alt={alt} openLabel={openLabel} light={light} />
      {paused && (
        <div className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${light ? 'border-[#e5d9b8] bg-[#fdf8ec] text-[#7a5f1a]' : 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300/90'}`}>
          <span className="font-medium">{labels.paused}</span> — {labels.pausedDesc}
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
