'use client'
// ── Mapa de cobertura — ver todas las zonas juntas ─────────────────────────────
// Toggle debajo de la tabla de zonas: dibuja el círculo (si tiene centro) y un
// pin por cada código postal (geocodificado una vez, cacheado) de TODAS las
// zonas activas, coloreado según el color de cada zona — para ver de un
// vistazo qué está cubierto y qué no.

import { useState, useEffect, useRef } from 'react'
import { Map, Marker, Circle } from '@vis.gl/react-google-maps'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, APPLE_WHITE_MAP_STYLES } from '@/lib/maps/config'

export interface ZoneForOverview {
  id: string
  name: string
  color: string | null
  radius_miles: number | null
  center_lat: number | null
  center_lng: number | null
  postal_codes: string[] | null
}

const MILES_TO_METERS = 1609.34

export function ZonesOverviewMap({
  zones,
  labels,
}: {
  zones: ZoneForOverview[]
  labels: { viewMap: string; hideMap: string }
}) {
  const [open, setOpen] = useState(false)
  const [pins, setPins] = useState<Record<string, { lat: number; lng: number }>>({})
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)

  useEffect(() => {
    if (!open) return
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder()

    const allCodes = new Set<string>()
    for (const z of zones) for (const c of z.postal_codes ?? []) allCodes.add(c)
    const missing = [...allCodes].filter((c) => !(c in pins))
    for (const code of missing) {
      geocoderRef.current.geocode({ address: code }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location
          setPins((prev) => ({ ...prev, [code]: { lat: loc.lat(), lng: loc.lng() } }))
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, zones])

  // Si una zona no tiene centro manual pero sí códigos postales ya
  // geocodificados, derivamos el centro del círculo de su centroide — antes
  // el radio quedaba invisible en el mapa si nunca se hacía clic para fijar
  // un centro (ej. zona creada solo con radio + código postal).
  function centerFor(z: ZoneForOverview): { lat: number; lng: number } | null {
    if (z.center_lat != null && z.center_lng != null) return { lat: z.center_lat, lng: z.center_lng }
    const zonePins = (z.postal_codes ?? []).filter((c) => c in pins).map((c) => pins[c])
    if (zonePins.length === 0) return null
    return {
      lat: zonePins.reduce((s, p) => s + p.lat, 0) / zonePins.length,
      lng: zonePins.reduce((s, p) => s + p.lng, 0) / zonePins.length,
    }
  }

  const circleZones = zones
    .filter((z) => z.radius_miles != null)
    .map((z) => ({ zone: z, center: centerFor(z) }))
    .filter((c): c is { zone: ZoneForOverview; center: { lat: number; lng: number } } => c.center != null)

  if (zones.length === 0) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-bronze hover:text-bronze/80 transition-colors"
      >
        {open ? labels.hideMap : labels.viewMap}
      </button>

      {open && (
        <div className="mt-2 rounded-xl overflow-hidden border border-sl-outline-variant h-72">
          <Map
            defaultCenter={DEFAULT_MAP_CENTER}
            defaultZoom={DEFAULT_MAP_ZOOM}
            styles={APPLE_WHITE_MAP_STYLES}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
          >
            {circleZones.map(({ zone: z, center }) => (
              <Circle
                key={z.id}
                center={center}
                radius={z.radius_miles! * MILES_TO_METERS}
                fillColor={z.color ?? '#8a6520'}
                fillOpacity={0.12}
                strokeColor={z.color ?? '#8a6520'}
                strokeWeight={1.5}
              />
            ))}
            {zones.flatMap((z) =>
              (z.postal_codes ?? [])
                .filter((c) => c in pins)
                .map((c) => (
                  <Marker key={`${z.id}-${c}`} position={pins[c]} title={`${z.name} — ${c}`} label={{ text: c.slice(-4), fontSize: '10px' }} />
                )),
            )}
          </Map>
        </div>
      )}
    </div>
  )
}
