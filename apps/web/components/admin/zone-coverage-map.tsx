'use client'
// ── Mapa de cobertura de UNA sola zona ─────────────────────────────────────────
// Se abre desde la acción "Ver zona" de cada fila en la tabla de Zonas de
// servicio. Dibuja solo el círculo/pines de esa zona (a diferencia de
// <ZonesOverviewMap>, que las muestra todas juntas) y ajusta el zoom/centro
// automáticamente para que toda su cobertura quede visible.

import { useEffect, useRef, useState } from 'react'
import { Map, Marker, Circle, useMap } from '@vis.gl/react-google-maps'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, APPLE_WHITE_MAP_STYLES } from '@/lib/maps/config'

const MILES_TO_METERS = 1609.34

export interface ZoneForCoverage {
  id: string
  name: string
  color: string | null
  radius_miles: number | null
  center_lat: number | null
  center_lng: number | null
  postal_codes: string[] | null
}

function FitToZone({ hasCircle, center, radiusMiles, pins }: {
  hasCircle: boolean
  center: { lat: number; lng: number } | null
  radiusMiles: number | null
  pins: Record<string, { lat: number; lng: number }>
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || typeof google === 'undefined') return
    const pinCoords = Object.values(pins)
    if (!hasCircle && pinCoords.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    if (hasCircle && center && radiusMiles) {
      const circleBounds = new google.maps.Circle({ center, radius: radiusMiles * MILES_TO_METERS }).getBounds()
      if (circleBounds) bounds.union(circleBounds)
    }
    for (const p of pinCoords) bounds.extend(p)
    map.fitBounds(bounds, 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hasCircle, center?.lat, center?.lng, radiusMiles, pins])

  return null
}

export function ZoneCoverageMap({ zone, noGeoHint }: { zone: ZoneForCoverage; noGeoHint: string }) {
  const [pins, setPins] = useState<Record<string, { lat: number; lng: number }>>({})
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const codes = zone.postal_codes ?? []

  useEffect(() => {
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder()
    const missing = codes.filter((c) => !(c in pins))
    for (const code of missing) {
      geocoderRef.current.geocode({ address: code }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location
          setPins((prev) => ({ ...prev, [code]: { lat: loc.lat(), lng: loc.lng() } }))
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join(',')])

  // Si la zona no tiene centro manual guardado, derivamos uno del centroide
  // de sus códigos postales ya geocodificados para que el radio sí se dibuje.
  const manualCenter = zone.center_lat != null && zone.center_lng != null ? { lat: zone.center_lat, lng: zone.center_lng } : null
  const geocodedPins = codes.filter((c) => c in pins).map((c) => pins[c])
  const autoCenter = geocodedPins.length > 0
    ? { lat: geocodedPins.reduce((s, p) => s + p.lat, 0) / geocodedPins.length, lng: geocodedPins.reduce((s, p) => s + p.lng, 0) / geocodedPins.length }
    : null
  const center = manualCenter ?? autoCenter
  const hasCircle = !!center && zone.radius_miles != null
  const hasAnyGeo = hasCircle || codes.length > 0

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-sl-outline-variant h-64">
        <Map
          defaultCenter={center ?? DEFAULT_MAP_CENTER}
          defaultZoom={center ? 12 : DEFAULT_MAP_ZOOM}
          styles={APPLE_WHITE_MAP_STYLES}
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
        >
          <FitToZone hasCircle={hasCircle} center={center} radiusMiles={zone.radius_miles} pins={pins} />
          {hasCircle && center && (
            <>
              <Marker position={center} />
              <Circle
                center={center}
                radius={zone.radius_miles! * MILES_TO_METERS}
                fillColor={zone.color ?? '#8a6520'}
                fillOpacity={0.14}
                strokeColor={zone.color ?? '#8a6520'}
                strokeWeight={1.5}
              />
            </>
          )}
          {codes.filter((c) => c in pins).map((c) => (
            <Marker key={c} position={pins[c]} title={`${zone.name} — ${c}`} label={{ text: c.slice(-4), fontSize: '10px' }} />
          ))}
        </Map>
      </div>
      {!hasAnyGeo && <p className="text-[11px] text-sl-on-surface-muted">{noGeoHint}</p>}
    </div>
  )
}
