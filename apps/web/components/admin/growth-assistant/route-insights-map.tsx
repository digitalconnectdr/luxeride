'use client'
// ── Mapa de rutas frecuentes (heatmap + corredores) ────────────────────────
// Mismo patrón imperativo que RoutePolylineLayer en
// apps/web/components/trip/interactive-live-map.tsx: capas de Google Maps
// nativas (HeatmapLayer, Polyline) montadas dentro del árbol declarativo de
// <Map> vía useEffect. 'visualization' se agregó a maps-provider.tsx para
// esto — antes no se usaba en ningún lado del proyecto.

import { useEffect, useRef, useState } from 'react'
import { Map, useMap } from '@vis.gl/react-google-maps'
import { MapsProvider } from '@/components/maps/maps-provider'
import { APPLE_WHITE_MAP_STYLES } from '@/lib/maps/config'
import type { Dictionary } from '@/lib/i18n/server'
import type { RouteCorridor, HeatmapPoint } from '@/lib/route-insights/engine'

type T = Dictionary['admin']['growthAssistant']

// Google eliminó HeatmapLayer de la Maps JavaScript API (deprecada, ya no
// disponible desde la versión 3.65 — ver
// https://developers.google.com/maps/deprecations) — descubierto en
// producción real (crash "The Heatmap Layer functionality... is no longer
// available"). Se reemplaza por círculos pequeños semitransparentes por
// punto: donde hay más reservas cercanas, los círculos se superponen y la
// zona se ve más intensa — mismo efecto visual de densidad, sin depender de
// una función retirada de la API.
function HeatmapPoints({ points, color, opacity }: { points: HeatmapPoint[]; color: string; opacity: number }) {
  const map = useMap()
  const circlesRef = useRef<google.maps.Circle[]>([])

  useEffect(() => {
    if (!map) return
    circlesRef.current.forEach((c) => c.setMap(null))
    circlesRef.current = points.map(
      (p) =>
        new google.maps.Circle({
          center: { lat: p.lat, lng: p.lng },
          radius: 300,
          strokeWeight: 0,
          fillColor: color,
          fillOpacity: opacity,
          map,
          clickable: false,
        }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points])

  useEffect(() => () => circlesRef.current.forEach((c) => c.setMap(null)), [])

  return null
}

function CorridorLines({ corridors, visible }: { corridors: RouteCorridor[]; visible: boolean }) {
  const map = useMap()
  const linesRef = useRef<google.maps.Polyline[]>([])
  const [active, setActive] = useState<RouteCorridor | null>(null)

  useEffect(() => {
    if (!map) return
    linesRef.current.forEach((l) => l.setMap(null))
    linesRef.current = []

    if (!visible) return

    const maxCount = Math.max(1, ...corridors.map((c) => c.count))
    for (const c of corridors) {
      if (c.originLat == null || c.originLng == null || c.destLat == null || c.destLng == null) continue
      const weight = 2 + (c.count / maxCount) * 8
      const line = new google.maps.Polyline({
        path: [{ lat: c.originLat, lng: c.originLng }, { lat: c.destLat, lng: c.destLng }],
        strokeColor: '#b8873a',
        strokeWeight: weight,
        strokeOpacity: 0.55,
      })
      line.addListener('click', () => setActive(c))
      line.setMap(map)
      linesRef.current.push(line)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, corridors, visible])

  useEffect(() => () => linesRef.current.forEach((l) => l.setMap(null)), [])

  if (!active) return null
  return (
    <div className="absolute top-3 left-3 bg-white border border-sl-outline-variant rounded-xl shadow-md px-3 py-2 text-xs space-y-0.5 max-w-[220px]">
      <button type="button" onClick={() => setActive(null)} className="float-right text-sl-on-surface-muted hover:text-sl-on-surface -mt-1 -mr-1">✕</button>
      <p className="font-semibold text-sl-on-surface">{active.originCity} → {active.destCity}</p>
      <p className="text-sl-on-surface-muted">{active.count} viajes · ${active.totalRevenue.toFixed(0)}</p>
    </div>
  )
}

function FitAllPoints({ pickupPoints, dropoffPoints }: { pickupPoints: HeatmapPoint[]; dropoffPoints: HeatmapPoint[] }) {
  const map = useMap()
  const fittedRef = useRef(false)

  useEffect(() => {
    if (!map || fittedRef.current) return
    const all = [...pickupPoints, ...dropoffPoints]
    if (all.length === 0) return
    fittedRef.current = true
    const bounds = new google.maps.LatLngBounds()
    all.forEach((p) => bounds.extend(p))
    map.fitBounds(bounds, 48)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pickupPoints, dropoffPoints])

  return null
}

export interface RouteInsightsMapProps {
  corridors: RouteCorridor[]
  pickupPoints: HeatmapPoint[]
  dropoffPoints: HeatmapPoint[]
  t: T
}

const DEFAULT_CENTER = { lat: 18.4861, lng: -69.9312 }

export function RouteInsightsMap({ corridors, pickupPoints, dropoffPoints, t }: RouteInsightsMapProps) {
  const [showCorridors, setShowCorridors] = useState(true)

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-sl-on-surface-muted">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#e9c176' }} />
            {t.legendPickup}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sl-on-surface-muted">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#c0473d' }} />
            {t.legendDropoff}
          </span>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-sl-on-surface-muted cursor-pointer">
          <input type="checkbox" checked={showCorridors} onChange={(e) => setShowCorridors(e.target.checked)} />
          {t.toggleCorridors}
        </label>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-sl-outline-variant h-96">
        <MapsProvider>
          <Map
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={10}
            styles={APPLE_WHITE_MAP_STYLES}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
          >
            <FitAllPoints pickupPoints={pickupPoints} dropoffPoints={dropoffPoints} />
            <HeatmapPoints points={pickupPoints} color="#e9c176" opacity={0.18} />
            <HeatmapPoints points={dropoffPoints} color="#c0473d" opacity={0.18} />
            <CorridorLines corridors={corridors} visible={showCorridors} />
          </Map>
        </MapsProvider>
      </div>
    </div>
  )
}
