'use client'
// ── Ciudad + país de la empresa, coordinados ────────────────────────────────
// Antes eran dos campos independientes (input de texto libre + select de
// país) - un operador escribió "Central Florida and the Northeast States,
// including New York and New Jersey" en el campo de ciudad, rompiendo el
// geocodificado del mapa de /super-admin/geography. Ahora el país filtra las
// sugerencias del autocompletado de ciudad (Google Places), y solo se guarda
// una ciudad si viene de una sugerencia real seleccionada.
//
// Vive dentro de app/admin/layout.tsx, que ya envuelve todo /admin en
// <MapsProvider> - no hace falta otro aquí.

import { useState } from 'react'
import { CityAutocompleteInput } from '@/components/maps/city-autocomplete-input'
import { COUNTRIES } from '@/lib/geo/countries'

export function CompanyCityCountryFields({
  cityLabel,
  countryLabel,
  cityDefault,
  countryDefault,
  inputCls,
  labelCls,
}: {
  cityLabel: string
  countryLabel: string
  cityDefault: string
  countryDefault: string
  inputCls: string
  labelCls: string
}) {
  const [country, setCountry] = useState(countryDefault || 'US')

  return (
    <>
      <div>
        <label className={labelCls}>{cityLabel}</label>
        <CityAutocompleteInput name="city" country={country} defaultValue={cityDefault} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>{countryLabel}</label>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <input type="hidden" name="country" value={country} />
      </div>
    </>
  )
}
