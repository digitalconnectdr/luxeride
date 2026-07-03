'use client'
// ── Radio + códigos postales + mapa interactivo de una zona ────────────────────
// Reemplaza el input de radio suelto y <PostalCodesInput> — ahora comparten un
// mapa: clic para fijar el CENTRO del círculo (antes no había forma de hacerlo,
// el radio se guardaba sin centro y el círculo nunca podía funcionar), círculo
// de vista previa según el radio, y un pin por cada código postal que se va
// agregando (geocodificado en el momento).

import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { Map, Marker, Circle, type MapMouseEvent } from '@vis.gl/react-google-maps'
import { InfoTip } from '@/components/ui/info-tip'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, APPLE_WHITE_MAP_STYLES } from '@/lib/maps/config'

const MILES_TO_METERS = 1609.34

export interface ZoneGeoLabels {
  radiusLabel: string
  radiusPlaceholder: string
  radiusHelp: string
  postalCodesLabel: string
  postalCodesPlaceholder: string
  postalCodesHelp: string
  mapHint: string
  clearCenter: string
}

export function ZoneGeoFields({
  defaultRadius,
  defaultCenterLat,
  defaultCenterLng,
  defaultPostalCodes = [],
  labels,
}: {
  defaultRadius?: number | null
  defaultCenterLat?: number | null
  defaultCenterLng?: number | null
  defaultPostalCodes?: string[]
  labels: ZoneGeoLabels
}) {
  const [radius, setRadius] = useState(defaultRadius != null ? String(defaultRadius) : '')
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    defaultCenterLat != null && defaultCenterLng != null ? { lat: defaultCenterLat, lng: defaultCenterLng } : null,
  )
  const [codes, setCodes] = useState<string[]>(defaultPostalCodes)
  const [draft, setDraft] = useState('')
  const [pins, setPins] = useState<Record<string, { lat: number; lng: number }>>({})
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)

  function addCode(raw: string) {
    const code = raw.trim()
    if (!code || codes.includes(code)) { setDraft(''); return }
    setCodes((prev) => [...prev, code])
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addCode(draft)
    } else if (e.key === 'Backspace' && !draft && codes.length) {
      setCodes((prev) => prev.slice(0, -1))
    }
  }

  // Geocodifica los códigos que todavía no tienen pin (cachea en `pins`)
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
  }, [codes])

  const radiusNum = parseFloat(radius)
  const hasCircle = !!center && Number.isFinite(radiusNum) && radiusNum > 0

  function handleMapClick(e: MapMouseEvent) {
    if (e.detail.latLng) setCenter({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng })
  }

  return (
    <div className="w-full space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">
            {labels.radiusLabel}
            <InfoTip text={labels.radiusHelp} />
          </label>
          <input
            name="radius_miles"
            type="number"
            min="0"
            step="0.1"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            placeholder={labels.radiusPlaceholder}
            className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">
            {labels.postalCodesLabel}
            <InfoTip text={labels.postalCodesHelp} />
          </label>
          {codes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {codes.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-xs bg-sl-bg border border-sl-outline-variant rounded-full pl-2.5 pr-1.5 py-1 text-sl-on-surface">
                  {c}
                  <button type="button" onClick={() => setCodes((prev) => prev.filter((x) => x !== c))} className="text-sl-on-surface-muted hover:text-red-500 leading-none" aria-label={`Quitar ${c}`}>×</button>
                </span>
              ))}
            </div>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addCode(draft)}
            placeholder={labels.postalCodesPlaceholder}
            className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-sl-outline-variant h-56">
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
          onClick={handleMapClick}
        >
          {center && <Marker position={center} />}
          {hasCircle && (
            <Circle
              center={center}
              radius={radiusNum * MILES_TO_METERS}
              fillColor="#8a6520"
              fillOpacity={0.12}
              strokeColor="#8a6520"
              strokeWeight={1.5}
            />
          )}
          {Object.entries(pins).map(([code, pos]) => (
            <Marker key={code} position={pos} label={{ text: code.slice(-4), fontSize: '10px' }} />
          ))}
        </Map>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-sl-on-surface-muted">{labels.mapHint}</p>
        {center && (
          <button type="button" onClick={() => setCenter(null)} className="text-[11px] text-sl-on-surface-muted hover:text-red-500 shrink-0">
            {labels.clearCenter}
          </button>
        )}
      </div>

      {/* Hidden inputs — lo que realmente lee el server action */}
      {center && <input type="hidden" name="center_lat" value={center.lat} />}
      {center && <input type="hidden" name="center_lng" value={center.lng} />}
      {codes.map((c) => (
        <input key={c} type="hidden" name="postal_codes" value={c} />
      ))}
    </div>
  )
}
