'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { PlaceResult } from '@/lib/maps/places'

export interface AddressInputProps {
  /** Nombre del campo — genera hidden inputs: name, name_lat, name_lng, name_place_id */
  name?: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  className?: string
  /** Se llama cuando el usuario selecciona una sugerencia del autocomplete */
  onPlaceSelect?: (place: PlaceResult) => void
  /** Se llama en cada cambio de texto (incluso si no hay selección) */
  onChange?: (value: string) => void
}

/**
 * Input de dirección con Google Places Autocomplete.
 *
 * IMPORTANTE: Debe estar dentro de un <MapsProvider> para funcionar.
 *
 * Si se pasa `name`, genera 4 hidden inputs para usar en Server Actions:
 *   - <name>          → dirección formateada
 *   - <name>_lat      → latitud
 *   - <name>_lng      → longitud
 *   - <name>_place_id → Google Place ID
 */
export function AddressInput({
  name,
  placeholder = 'Ingresa una dirección...',
  defaultValue = '',
  required,
  disabled,
  className,
  onPlaceSelect,
  onChange,
}: AddressInputProps) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const acRef     = useRef<google.maps.places.Autocomplete | null>(null)
  const [text,    setText]    = useState(defaultValue)
  const [lat,     setLat]     = useState<number | ''>('')
  const [lng,     setLng]     = useState<number | ''>('')
  const [placeId, setPlaceId] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [authFailed, setAuthFailed] = useState(false)

  const placesLib = useMapsLibrary('places')

  // Si Google rechaza la API key, deshabilita el input y le pone un
  // placeholder de error ("Se ha producido un error."). Lo revertimos para
  // que el usuario no quede bloqueado, y mostramos un aviso claro.
  useEffect(() => {
    function onAuthFailure() {
      setAuthFailed(true)
      if (inputRef.current) {
        inputRef.current.disabled = false
        inputRef.current.placeholder = placeholder
        inputRef.current.style.backgroundImage = 'none'
      }
    }
    window.addEventListener('luxeride:gm-auth-failure', onAuthFailure)
    return () => window.removeEventListener('luxeride:gm-auth-failure', onAuthFailure)
  }, [placeholder])

  const handlePlaceChanged = useCallback(() => {
    const place = acRef.current?.getPlace()
    if (!place?.geometry?.location) return

    const postal = place.address_components?.find((c) => c.types.includes('postal_code'))?.long_name

    const result: PlaceResult = {
      address: place.formatted_address ?? '',
      lat:     place.geometry.location.lat(),
      lng:     place.geometry.location.lng(),
      placeId: place.place_id ?? '',
      postalCode: postal,
    }

    setText(result.address)
    setLat(result.lat)
    setLng(result.lng)
    setPlaceId(result.placeId)
    setPostalCode(postal ?? '')
    onChange?.(result.address)
    onPlaceSelect?.(result)
  }, [onChange, onPlaceSelect])

  useEffect(() => {
    if (!placesLib || !inputRef.current || acRef.current) return

    acRef.current = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'formatted_address', 'place_id', 'address_components'],
    })
    acRef.current.addListener('place_changed', handlePlaceChanged)

    return () => {
      if (acRef.current) {
        google.maps.event.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
  }, [placesLib, handlePlaceChanged])

  const inputCls =
    className ??
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm ' +
    'text-[#1d1d1f] placeholder:text-gray-400 ' +
    'focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 ' +
    'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ' +
    'transition-colors'

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange?.(e.target.value)
          // Limpiar coords si el usuario escribe manualmente sin seleccionar sugerencia
          setLat('')
          setLng('')
          setPlaceId('')
          setPostalCode('')
        }}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={inputCls}
        autoComplete="off"
        aria-autocomplete="list"
        aria-label={placeholder}
      />

      {authFailed && (
        <p className="mt-1 text-[11px] text-amber-600">
          ⚠ El autocompletado de direcciones no está disponible (Google Maps rechazó la API key
          en este dominio). Verifica las restricciones del key en Google Cloud Console.
        </p>
      )}

      {/* Hidden inputs para Server Actions — solo si se pasa name */}
      {name && (
        <>
          <input type="hidden" name={name}              value={text} />
          <input type="hidden" name={`${name}_lat`}     value={lat} />
          <input type="hidden" name={`${name}_lng`}     value={lng} />
          <input type="hidden" name={`${name}_place_id`} value={placeId} />
          <input type="hidden" name={`${name}_postal_code`} value={postalCode} />
        </>
      )}
    </>
  )
}
