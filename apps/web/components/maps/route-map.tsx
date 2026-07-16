'use client'

import { useEffect, useRef } from 'react'
import { Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { APPLE_WHITE_MAP_STYLES, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/maps/config'
import type { PlaceResult } from '@/lib/maps/places'

// ── Renderizador de ruta ────────────────────────────────────────────────────

interface DirectionsRendererProps {
  origin:      PlaceResult
  destination: PlaceResult
}

function DirectionsLayer({ origin, destination }: DirectionsRendererProps) {
  const map       = useMap()
  const routesLib = useMapsLibrary('routes')
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  useEffect(() => {
    if (!map || !routesLib) return

    // Crear renderer solo una vez
    if (!rendererRef.current) {
      rendererRef.current = new routesLib.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor:   '#8a6520',  // Bronce LuxeRide
          strokeWeight:  4,
          strokeOpacity: 0.85,
        },
        markerOptions: {
          animation: null,
        },
      })
      rendererRef.current.setMap(map)
    }

    const service = new routesLib.DirectionsService()
    service.route(
      {
        origin:      { lat: origin.lat,      lng: origin.lng      },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode:  google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          rendererRef.current?.setDirections(result)
        }
      },
    )

    return () => {
      rendererRef.current?.setMap(null)
      rendererRef.current = null
    }
  }, [map, routesLib, origin.lat, origin.lng, destination.lat, destination.lng])

  return null
}

// ── Componente principal ─────────────────────────────────────────────────────

export interface RouteMapProps {
  origin?:      PlaceResult | null
  destination?: PlaceResult | null
  /** Clases de Tailwind para el contenedor (default: h-64 rounded-xl) */
  className?: string
}

/**
 * Mapa interactivo que muestra la ruta entre origen y destino.
 *
 * - Si no hay origen/destino, muestra un mapa vacío centrado en RD.
 * - Si solo hay origen, centra el mapa en el origen.
 * - Si hay ambos, dibuja la ruta con línea azul Apple Blue.
 *
 * IMPORTANTE: Debe estar dentro de un <MapsProvider>.
 */
export function RouteMap({ origin, destination, className }: RouteMapProps) {
  const center = origin
    ? { lat: origin.lat, lng: origin.lng }
    : DEFAULT_MAP_CENTER

  return (
    <div className={className ?? 'h-64 w-full rounded-xl overflow-hidden border border-gray-200'}>
      <Map
        defaultCenter={center}
        defaultZoom={origin && destination ? 11 : DEFAULT_MAP_ZOOM}
        styles={APPLE_WHITE_MAP_STYLES}
        gestureHandling="cooperative"
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
      >
        {origin && destination && (
          <DirectionsLayer origin={origin} destination={destination} />
        )}
      </Map>
    </div>
  )
}
