'use client'
// ── Mapas de geografía: visitantes del landing vs. empresas registradas ────
// Dos mapas independientes, mismo patrón visual que zones-overview-map.tsx
// (Marker con label numérico = conteo). El de visitantes usa lat/lng ya
// calculados en el servidor (promedio por ciudad, guardado al llegar la
// visita). El de empresas geocodifica `city, country` en el navegador con
// google.maps.Geocoder() - mismo patrón ya usado en zones-overview-map.tsx -
// porque companies no guarda coordenadas, solo el nombre de la ciudad.

import { useEffect, useRef, useState } from 'react'
import { Map, Marker } from '@vis.gl/react-google-maps'
import { MapsProvider } from '@/components/maps/maps-provider'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, APPLE_WHITE_MAP_STYLES } from '@/lib/maps/config'

export interface CityCount {
  city: string
  country: string | null
  count: number
  lat: number | null
  lng: number | null
}

function FitBoundsMap({
  points,
  children,
}: {
  points: { lat: number; lng: number }[]
  children: React.ReactNode
}) {
  return (
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
      {...(points.length > 0
        ? {
            defaultBounds: {
              north: Math.max(...points.map((p) => p.lat)) + 0.5,
              south: Math.min(...points.map((p) => p.lat)) - 0.5,
              east: Math.max(...points.map((p) => p.lng)) + 0.5,
              west: Math.min(...points.map((p) => p.lng)) - 0.5,
            },
          }
        : {})}
    >
      {children}
    </Map>
  )
}

function VisitorsMap({ cities }: { cities: CityCount[] }) {
  const points = cities.filter((c): c is CityCount & { lat: number; lng: number } => c.lat != null && c.lng != null)
  const maxCount = Math.max(1, ...points.map((p) => p.count))

  return (
    <FitBoundsMap points={points}>
      {points.map((c) => (
        <Marker
          key={`${c.city}-${c.country}`}
          position={{ lat: c.lat, lng: c.lng }}
          title={`${c.city}${c.country ? ', ' + c.country : ''} — ${c.count} visita${c.count === 1 ? '' : 's'}`}
          label={{ text: String(c.count), fontSize: '11px', fontWeight: 'bold', color: '#1d1b18' }}
          opacity={0.55 + 0.45 * (c.count / maxCount)}
        />
      ))}
    </FitBoundsMap>
  )
}

function CompaniesMap({ cities }: { cities: CityCount[] }) {
  const [pins, setPins] = useState<Record<string, { lat: number; lng: number }>>({})
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)

  useEffect(() => {
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder()

    const missing = cities.filter((c) => !(`${c.city}|${c.country}` in pins))
    for (const c of missing) {
      const key = `${c.city}|${c.country}`
      const address = [c.city, c.country].filter(Boolean).join(', ')
      geocoderRef.current.geocode({ address }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location
          setPins((prev) => ({ ...prev, [key]: { lat: loc.lat(), lng: loc.lng() } }))
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  const points = cities
    .map((c) => ({ ...c, geo: pins[`${c.city}|${c.country}`] }))
    .filter((c): c is CityCount & { geo: { lat: number; lng: number } } => !!c.geo)
  const maxCount = Math.max(1, ...points.map((p) => p.count))

  return (
    <FitBoundsMap points={points.map((p) => p.geo)}>
      {points.map((c) => (
        <Marker
          key={`${c.city}-${c.country}`}
          position={c.geo}
          title={`${c.city}${c.country ? ', ' + c.country : ''} — ${c.count} empresa${c.count === 1 ? '' : 's'}`}
          label={{ text: String(c.count), fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}
          opacity={0.55 + 0.45 * (c.count / maxCount)}
        />
      ))}
    </FitBoundsMap>
  )
}

export function GeographyMaps({
  visitorCities,
  companyCities,
}: {
  visitorCities: CityCount[]
  companyCities: CityCount[]
}) {
  return (
    <MapsProvider>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl overflow-hidden border border-[#e5e1d8] h-96">
          <VisitorsMap cities={visitorCities} />
        </div>
        <div className="rounded-xl overflow-hidden border border-[#e5e1d8] h-96">
          <CompaniesMap cities={companyCities} />
        </div>
      </div>
    </MapsProvider>
  )
}
