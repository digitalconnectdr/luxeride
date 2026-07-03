import { describe, it, expect } from 'vitest'
import { resolveZoneId, type ServiceZoneForMatch } from './zones'

// Santiago de los Caballeros, RD — coords reales para los tests de círculo.
const AIRPORT = { lat: 19.4061, lng: -70.6047 }
const FAR_AWAY = { lat: 18.4861, lng: -69.9312 } // Santo Domingo — bien lejos

describe('resolveZoneId', () => {
  it('coincide por código postal', () => {
    const zones: ServiceZoneForMatch[] = [
      { id: 'z1', postal_codes: ['51000', '51001'], center_lat: null, center_lng: null, radius_miles: null },
    ]
    expect(resolveZoneId(zones, { lat: 0, lng: 0, postalCode: '51000' })).toBe('z1')
  })

  it('sin coincidencia de código postal ni círculo → null', () => {
    const zones: ServiceZoneForMatch[] = [
      { id: 'z1', postal_codes: ['51000'], center_lat: null, center_lng: null, radius_miles: null },
    ]
    expect(resolveZoneId(zones, { lat: 0, lng: 0, postalCode: '99999' })).toBeNull()
  })

  it('código postal: gana la zona MÁS ESPECÍFICA (menos códigos) si hay solape', () => {
    const zones: ServiceZoneForMatch[] = [
      { id: 'broad', postal_codes: ['51000', '51001', '51002'], center_lat: null, center_lng: null, radius_miles: null },
      { id: 'narrow', postal_codes: ['51000'], center_lat: null, center_lng: null, radius_miles: null },
    ]
    expect(resolveZoneId(zones, { lat: 0, lng: 0, postalCode: '51000' })).toBe('narrow')
  })

  it('coincide por círculo cuando no hay código postal', () => {
    const zones: ServiceZoneForMatch[] = [
      { id: 'airport-zone', postal_codes: [], center_lat: AIRPORT.lat, center_lng: AIRPORT.lng, radius_miles: 5 },
    ]
    expect(resolveZoneId(zones, { lat: AIRPORT.lat, lng: AIRPORT.lng })).toBe('airport-zone')
  })

  it('círculo: fuera del radio → null', () => {
    const zones: ServiceZoneForMatch[] = [
      { id: 'airport-zone', postal_codes: [], center_lat: AIRPORT.lat, center_lng: AIRPORT.lng, radius_miles: 5 },
    ]
    expect(resolveZoneId(zones, { lat: FAR_AWAY.lat, lng: FAR_AWAY.lng })).toBeNull()
  })

  it('círculo: gana el radio más chico si se solapan', () => {
    const zones: ServiceZoneForMatch[] = [
      { id: 'big', postal_codes: [], center_lat: AIRPORT.lat, center_lng: AIRPORT.lng, radius_miles: 20 },
      { id: 'small', postal_codes: [], center_lat: AIRPORT.lat, center_lng: AIRPORT.lng, radius_miles: 3 },
    ]
    expect(resolveZoneId(zones, { lat: AIRPORT.lat, lng: AIRPORT.lng })).toBe('small')
  })

  it('código postal tiene prioridad sobre círculo aunque ambos coincidan', () => {
    const zones: ServiceZoneForMatch[] = [
      { id: 'by-circle', postal_codes: [], center_lat: AIRPORT.lat, center_lng: AIRPORT.lng, radius_miles: 5 },
      { id: 'by-postal', postal_codes: ['51000'], center_lat: null, center_lng: null, radius_miles: null },
    ]
    expect(resolveZoneId(zones, { lat: AIRPORT.lat, lng: AIRPORT.lng, postalCode: '51000' })).toBe('by-postal')
  })

  it('sin zonas → null', () => {
    expect(resolveZoneId([], { lat: 0, lng: 0 })).toBeNull()
  })
})
