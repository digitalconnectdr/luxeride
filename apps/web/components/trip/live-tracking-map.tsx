'use client'
// ── Mapa en vivo (conductor↔pasajero, solo mientras el viaje está activo) ─────
// Se refresca por un intervalo corto (server action, que también hace cumplir
// la cuota mensual del plan — ver lib/tracking/live-tracking-quota.ts) cada
// ~15s. NO se puede depender solo de Supabase Realtime aquí: el pasajero
// navega sin sesión (link público) y las políticas de seguridad de
// trip_locations no le dan acceso de lectura directo, así que Realtime nunca
// le entrega esos eventos — el polling es el mecanismo principal, Realtime
// solo acelera el refresco cuando SÍ hay una sesión con acceso (conductor).
// Si el conductor deja de reportar posición por más de ~50s con el viaje aún
// activo, se muestra un aviso de "vista en pausa" en vez de un mapa congelado.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { refreshLiveMapAction, reportPassengerLocationAction } from '@/app/actions/live-tracking'
import { StaticMap } from '@/components/trip/static-map'

const REFRESH_INTERVAL_MS = 15_000
const STALE_AFTER_MS = 50_000

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
  const watchIdRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    const res = await refreshLiveMapAction(bookingId)
    if (!res) return
    setMapSrc(res.url)
    const recordedAt = res.driverRecordedAt ? new Date(res.driverRecordedAt).getTime() : null
    setPaused(recordedAt === null || Date.now() - recordedAt > STALE_AFTER_MS)
  }, [bookingId])

  // Refresco periódico (mecanismo principal — funciona sin sesión).
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Realtime: acelera el refresco cuando la sesión SÍ tiene acceso de lectura
  // (p.ej. el conductor). Para el pasajero (sin sesión) simplemente no llega
  // ningún evento y el polling de arriba sigue funcionando igual.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`trip-location-${bookingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_locations', filter: `booking_id=eq.${bookingId}` },
        () => refresh(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [bookingId, refresh])

  // Si la fase del viaje deja de permitir compartir (p.ej. pasó a "en curso" —
  // conductor y pasajero ya están juntos, no tiene sentido seguir), se apaga
  // solo aunque el pasajero lo hubiera activado antes.
  useEffect(() => {
    if (!allowPassengerShare) setSharing(false)
  }, [allowPassengerShare])

  // Compartir la ubicación del pasajero (opt-in explícito, nunca automático).
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
