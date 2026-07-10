'use client'
// ── Mapa en vivo de la flota — arriba del tablero de columnas ─────────────────
// Mapa interactivo (JS API) con pan/zoom real — antes era una imagen Static
// Maps sin control de zoom que quedaba pegada al único marcador disponible.
// Se refresca solo cada 20s reposicionando los marcadores (sin recargar el
// mapa en sí), mismo patrón de polling que el resto del sistema.

import { useCallback, useEffect, useState } from 'react'
import { Map, Marker, useMap } from '@vis.gl/react-google-maps'
import { refreshDispatchMapAction, type DispatchMapPoint } from '@/app/actions/dispatch-map'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, APPLE_WHITE_MAP_STYLES } from '@/lib/maps/config'

const REFRESH_INTERVAL_MS = 20_000
const SINGLE_POINT_ZOOM = 13
const FIT_BOUNDS_PADDING = 56

export interface DispatchLiveMapLabels {
  title: string
  empty: string
  legendDriver: string
  legendPending: string
  legendIdle: string
}

function markerIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="9" fill="${color}" stroke="#ffffff" stroke-width="2"/></svg>`
  return { url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}` }
}

const MARKER_COLOR: Record<DispatchMapPoint['kind'], string> = {
  driver: '#22c55e',
  pending: '#f59e0b',
  idle: '#3b82f6',
}

/** Encuadra el mapa según los puntos disponibles — con un solo punto, fitBounds
 *  produciría un zoom absurdo (bounds de tamaño cero), así que ese caso se
 *  maneja aparte con un zoom fijo razonable. */
function FitToPoints({ points }: { points: DispatchMapPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || points.length === 0) return
    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng })
      map.setZoom(SINGLE_POINT_ZOOM)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
    map.fitBounds(bounds, FIT_BOUNDS_PADDING)
  }, [map, points])

  return null
}

export function DispatchLiveMap({ labels }: { labels: DispatchLiveMapLabels }) {
  const [points, setPoints] = useState<DispatchMapPoint[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const res = await refreshDispatchMapAction()
    if (!res) return
    setPoints(res.points)
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const driverCount = points.filter((p) => p.kind === 'driver').length
  const pendingCount = points.filter((p) => p.kind === 'pending').length
  const idleCount = points.filter((p) => p.kind === 'idle').length

  if (!loaded) return null

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-sl-outline-variant flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{labels.title}</p>
        {points.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-sl-on-surface-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {driverCount} {labels.legendDriver}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {pendingCount} {labels.legendPending}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> {idleCount} {labels.legendIdle}</span>
          </div>
        )}
      </div>
      {points.length > 0 ? (
        <div className="h-[420px] w-full">
          <Map
            defaultCenter={DEFAULT_MAP_CENTER}
            defaultZoom={DEFAULT_MAP_ZOOM}
            styles={APPLE_WHITE_MAP_STYLES}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
          >
            <FitToPoints points={points} />
            {points.map((p) => (
              <Marker
                key={p.id}
                position={{ lat: p.lat, lng: p.lng }}
                icon={markerIcon(MARKER_COLOR[p.kind])}
                title={p.label || undefined}
              />
            ))}
          </Map>
        </div>
      ) : (
        <p className="text-sm text-sl-on-surface-muted text-center py-10">{labels.empty}</p>
      )}
    </div>
  )
}
