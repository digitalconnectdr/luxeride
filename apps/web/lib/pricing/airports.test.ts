import { describe, it, expect } from 'vitest'
import { resolveAirportFees, AIRPORT_MATCH_RADIUS_MILES, type CompanyAirportForMatch } from './airports'

// JFK aprox.
const JFK: CompanyAirportForMatch = { airportId: 'jfk', lat: 40.6413, lng: -73.7781, pickupFee: 25, dropoffFee: 30 }
// LGA aprox. (~9.5 millas de JFK — suficientemente lejos para no solaparse)
const LGA: CompanyAirportForMatch = { airportId: 'lga', lat: 40.7769, lng: -73.8740, pickupFee: 15, dropoffFee: 20 }
// Punto claramente lejos de ambos (Manhattan, ~8-15 millas)
const MANHATTAN = { lat: 40.7580, lng: -73.9855 }

describe('resolveAirportFees', () => {
  it('sin aeropuertos configurados, no cobra nada', () => {
    const result = resolveAirportFees([], JFK, MANHATTAN)
    expect(result).toEqual({ pickupFee: 0, dropoffFee: 0, pickupAirportId: null, dropoffAirportId: null })
  })

  it('pickup exactamente en el aeropuerto configurado cobra su fee de pickup', () => {
    const result = resolveAirportFees([JFK], { lat: JFK.lat, lng: JFK.lng }, MANHATTAN)
    expect(result.pickupFee).toBe(25)
    expect(result.pickupAirportId).toBe('jfk')
    expect(result.dropoffFee).toBe(0)
    expect(result.dropoffAirportId).toBeNull()
  })

  it('dropoff exactamente en el aeropuerto configurado cobra su fee de dropoff', () => {
    const result = resolveAirportFees([JFK], MANHATTAN, { lat: JFK.lat, lng: JFK.lng })
    expect(result.pickupFee).toBe(0)
    expect(result.dropoffFee).toBe(30)
    expect(result.dropoffAirportId).toBe('jfk')
  })

  it('viaje entre dos aeropuertos configurados cobra ambos cargos', () => {
    const result = resolveAirportFees([JFK, LGA], { lat: JFK.lat, lng: JFK.lng }, { lat: LGA.lat, lng: LGA.lng })
    expect(result.pickupFee).toBe(25)
    expect(result.pickupAirportId).toBe('jfk')
    expect(result.dropoffFee).toBe(20)
    expect(result.dropoffAirportId).toBe('lga')
  })

  it('punto fuera del radio no cobra nada aunque haya aeropuertos configurados', () => {
    const result = resolveAirportFees([JFK, LGA], MANHATTAN, MANHATTAN)
    expect(result).toEqual({ pickupFee: 0, dropoffFee: 0, pickupAirportId: null, dropoffAirportId: null })
  })

  it('con dos aeropuertos cercanos, elige el más cercano al punto', () => {
    // Punto muy cerca de LGA pero dentro del radio de ninguno de JFK
    const nearLga = { lat: LGA.lat + 0.001, lng: LGA.lng }
    const result = resolveAirportFees([JFK, LGA], nearLga, MANHATTAN)
    expect(result.pickupAirportId).toBe('lga')
    expect(result.pickupFee).toBe(15)
  })

  it('el radio de coincidencia es de 1 milla', () => {
    expect(AIRPORT_MATCH_RADIUS_MILES).toBe(1)
  })
})
