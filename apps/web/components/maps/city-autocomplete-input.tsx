'use client'
// ── Input de ciudad restringido a Google Places Autocomplete ───────────────
// A diferencia de AddressInput (direcciones completas), este solo acepta
// CIUDADES reales (types: ['(cities)']), filtradas por el país seleccionado
// (componentRestrictions). Si el usuario escribe pero no selecciona una
// sugerencia real, el valor se descarta al perder el foco - así el campo
// nunca guarda texto libre inventado (motivo: un operador escribió "Central
// Florida and the Northeast States, including New York and New Jersey" como
// ciudad, rompiendo el geocodificado del mapa de /super-admin/geography).
//
// IMPORTANTE: debe estar dentro de un <MapsProvider>.

import { useRef, useEffect, useState, useCallback } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'

export interface CityAutocompleteInputProps {
  /** Nombre del hidden input que viaja en el submit del form */
  name: string
  /** Código ISO del país (ej. 'US') — filtra las sugerencias a ese país */
  country: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
  className?: string
}

export function CityAutocompleteInput({
  name,
  country,
  placeholder = 'Escribe y selecciona tu ciudad...',
  defaultValue = '',
  required,
  className,
}: CityAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [text, setText] = useState(defaultValue)
  // El valor por defecto (ya guardado) se asume válido - solo se invalida
  // cuando el usuario empieza a escribir algo distinto sin seleccionar.
  const [valid, setValid] = useState(!!defaultValue)
  // Si Google rechaza la API key (billing caído, restricción de dominio mal
  // configurada, etc.) no queremos bloquear un campo OPCIONAL por completo -
  // mismo evento que ya escucha AddressInput (components/maps/address-input.tsx).
  // En este modo se acepta lo que el usuario escriba, sin exigir selección.
  const [authFailed, setAuthFailed] = useState(false)

  const placesLib = useMapsLibrary('places')

  useEffect(() => {
    function onAuthFailure() {
      setAuthFailed(true)
      setValid(true)
    }
    window.addEventListener('luxeride:gm-auth-failure', onAuthFailure)
    return () => window.removeEventListener('luxeride:gm-auth-failure', onAuthFailure)
  }, [])

  const handlePlaceChanged = useCallback(() => {
    const place = acRef.current?.getPlace()
    const cityComponent = place?.address_components?.find(
      (c) => c.types.includes('locality') || c.types.includes('postal_town'),
    )
    const cityName = cityComponent?.long_name ?? place?.name ?? ''
    if (!cityName) return
    setText(cityName)
    setValid(true)
  }, [])

  // Crea el Autocomplete una sola vez.
  useEffect(() => {
    if (!placesLib || !inputRef.current || acRef.current) return

    acRef.current = new placesLib.Autocomplete(inputRef.current, {
      types: ['(cities)'],
      componentRestrictions: { country },
      fields: ['address_components', 'name'],
    })
    acRef.current.addListener('place_changed', handlePlaceChanged)

    return () => {
      if (acRef.current) {
        google.maps.event.clearInstanceListeners(acRef.current)
        acRef.current = null
      }
    }
  }, [placesLib, handlePlaceChanged, country])

  // Si cambia el país después de creado, re-filtra sin recrear la instancia.
  useEffect(() => {
    acRef.current?.setComponentRestrictions({ country })
  }, [country])

  const inputCls =
    className ??
    'w-full rounded-lg border border-sl-outline-variant bg-sl-bg px-4 py-3 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze transition-colors'

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (!authFailed) setValid(false)
        }}
        onBlur={() => {
          // No seleccionó una sugerencia real - se descarta, no se guarda texto libre.
          // Salvo que el autocompletado esté caído (authFailed): ahí aceptamos lo escrito.
          if (!valid && !authFailed) setText('')
        }}
        placeholder={placeholder}
        required={required}
        className={inputCls}
        autoComplete="off"
        aria-autocomplete="list"
        aria-label={placeholder}
      />
      {authFailed && (
        <p className="mt-1 text-[11px] text-amber-600">
          ⚠ El autocompletado de ciudades no está disponible ahora mismo. Puedes escribirla igual.
        </p>
      )}
      <input type="hidden" name={name} value={valid ? text : ''} />
    </>
  )
}
