import { describe, it, expect } from 'vitest'
import { aggregateRoutes, type RouteInsightBooking } from './engine'

function booking(overrides: Partial<RouteInsightBooking>): RouteInsightBooking {
  return {
    pickupCity: 'Santo Domingo',
    pickupCountry: 'Dominican Republic',
    pickupLat: 18.48,
    pickupLng: -69.93,
    dropoffCity: 'Punta Cana',
    dropoffCountry: 'Dominican Republic',
    dropoffLat: 18.58,
    dropoffLng: -68.4,
    totalAmount: 100,
    bookingSource: 'web',
    ...overrides,
  }
}

describe('aggregateRoutes', () => {
  it('groups identical corridors and sums revenue/count', () => {
    const result = aggregateRoutes([booking({}), booking({ totalAmount: 50 })])
    expect(result.corridors).toHaveLength(1)
    expect(result.corridors[0].count).toBe(2)
    expect(result.corridors[0].totalRevenue).toBe(150)
    expect(result.corridors[0].avgFare).toBe(75)
  })

  it('sorts corridors by volume descending and respects topN', () => {
    const result = aggregateRoutes(
      [
        booking({ dropoffCity: 'Santiago' }),
        booking({}),
        booking({}),
      ],
      { topN: 1 },
    )
    expect(result.corridors).toHaveLength(1)
    expect(result.corridors[0].destCity).toBe('Punta Cana')
    expect(result.corridors[0].count).toBe(2)
  })

  it('discards bookings with no resolved city (null or empty string) from city/corridor groups', () => {
    const result = aggregateRoutes([
      booking({}),
      booking({ pickupCity: null }),
      booking({ dropoffCity: '' }),
    ])
    expect(result.corridors).toHaveLength(1)
    expect(result.corridors[0].count).toBe(1)
    // la reserva con pickupCity null sí cuenta como destino (Punta Cana) aunque no como origen
    const puntaCana = result.topDestinationCities.find((c) => c.city === 'Punta Cana')
    expect(puntaCana?.count).toBe(2)
  })

  it('computes a centroid only from bookings with coordinates, ignoring bookings without them', () => {
    const result = aggregateRoutes([
      booking({}),
      booking({ pickupLat: null, pickupLng: null }),
    ])
    expect(result.topOriginCities[0].lat).toBeCloseTo(18.48)
    expect(result.topOriginCities[0].lng).toBeCloseTo(-69.93)
  })

  it('splits pickup and dropoff points into separate heatmap arrays', () => {
    const result = aggregateRoutes([booking({})])
    expect(result.pickupHeatmapPoints).toEqual([{ lat: 18.48, lng: -69.93 }])
    expect(result.dropoffHeatmapPoints).toEqual([{ lat: 18.58, lng: -68.4 }])
  })

  it('returns empty arrays for no bookings', () => {
    const result = aggregateRoutes([])
    expect(result.corridors).toEqual([])
    expect(result.topOriginCities).toEqual([])
    expect(result.topDestinationCities).toEqual([])
    expect(result.bySource).toEqual({ web: 0, mobileApp: 0, staff: 0 })
  })

  it('counts bookings by channel (web/mobile_app/staff)', () => {
    const result = aggregateRoutes([
      booking({ bookingSource: 'web' }),
      booking({ bookingSource: 'mobile_app' }),
      booking({ bookingSource: 'mobile_app' }),
      booking({ bookingSource: 'staff' }),
    ])
    expect(result.bySource).toEqual({ web: 1, mobileApp: 2, staff: 1 })
  })
})
