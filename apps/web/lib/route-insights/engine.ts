// ── Agregación de rutas frecuentes — pura y testeada ───────────────────────
// Mismo estilo que lib/operator-score/engine.ts y lib/pricing/engine.ts:
// función pura que recibe filas y devuelve datos agregados, sin tocar la
// base de datos ni el servidor. Alimenta el reporte del add-on AI Growth
// Assistant (/admin/growth-assistant, pestaña "Rutas frecuentes").

export type BookingSource = 'web' | 'mobile_app' | 'staff'

export interface RouteInsightBooking {
  pickupCity: string | null
  pickupCountry: string | null
  pickupLat: number | null
  pickupLng: number | null
  dropoffCity: string | null
  dropoffCountry: string | null
  dropoffLat: number | null
  dropoffLng: number | null
  totalAmount: number | null
  bookingSource: BookingSource
  // Ciudad/país desde donde se HIZO la solicitud (geolocalización por IP del
  // request, ver createPublicBookingAction) — puede diferir de pickupCity
  // (alguien en Santo Domingo reservando un viaje en Nueva York).
  requesterCity: string | null
  requesterCountry: string | null
}

export interface RouteCorridor {
  originCity: string
  originCountry: string | null
  destCity: string
  destCountry: string | null
  count: number
  totalRevenue: number
  avgFare: number
  originLat: number | null
  originLng: number | null
  destLat: number | null
  destLng: number | null
  // Ciudad del solicitante más frecuente entre las reservas de este corredor
  // (no todas vienen del mismo lugar) — null si ninguna reserva del grupo
  // tiene ciudad de solicitante resuelta.
  topRequesterCity: string | null
  topRequesterCountry: string | null
}

export interface CityAggregate {
  city: string
  country: string | null
  count: number
  totalRevenue: number
  lat: number | null
  lng: number | null
}

export interface HeatmapPoint {
  lat: number
  lng: number
}

export interface SourceBreakdown {
  web: number
  mobileApp: number
  staff: number
}

export interface RouteInsightsResult {
  corridors: RouteCorridor[]
  topOriginCities: CityAggregate[]
  topDestinationCities: CityAggregate[]
  pickupHeatmapPoints: HeatmapPoint[]
  dropoffHeatmapPoints: HeatmapPoint[]
  bySource: SourceBreakdown
}

interface GroupAccumulator {
  count: number
  totalRevenue: number
  latSum: number
  lngSum: number
  coordCount: number
}

function centroid(acc: GroupAccumulator): { lat: number | null; lng: number | null } {
  if (acc.coordCount === 0) return { lat: null, lng: null }
  return { lat: acc.latSum / acc.coordCount, lng: acc.lngSum / acc.coordCount }
}

/** '' y null representan "sin ciudad resuelta" (ver cron de backfill) — ambos se descartan. */
function hasCity(city: string | null): city is string {
  return !!city
}

export function aggregateRoutes(bookings: RouteInsightBooking[], opts?: { topN?: number }): RouteInsightsResult {
  const topN = opts?.topN ?? 20

  const corridorGroups = new Map<string, GroupAccumulator & {
    originCity: string; originCountry: string | null; destCity: string; destCountry: string | null
    requesterCounts: Map<string, { city: string; country: string | null; count: number }>
  }>()
  const originGroups = new Map<string, GroupAccumulator & { city: string; country: string | null }>()
  const destGroups = new Map<string, GroupAccumulator & { city: string; country: string | null }>()
  const pickupHeatmapPoints: HeatmapPoint[] = []
  const dropoffHeatmapPoints: HeatmapPoint[] = []
  const bySource: SourceBreakdown = { web: 0, mobileApp: 0, staff: 0 }

  for (const b of bookings) {
    const revenue = b.totalAmount ?? 0

    if (b.bookingSource === 'mobile_app') bySource.mobileApp++
    else if (b.bookingSource === 'staff') bySource.staff++
    else bySource.web++

    if (b.pickupLat != null && b.pickupLng != null) {
      pickupHeatmapPoints.push({ lat: b.pickupLat, lng: b.pickupLng })
    }
    if (b.dropoffLat != null && b.dropoffLng != null) {
      dropoffHeatmapPoints.push({ lat: b.dropoffLat, lng: b.dropoffLng })
    }

    if (hasCity(b.pickupCity)) {
      const key = `${b.pickupCity}|${b.pickupCountry ?? ''}`
      const existing = originGroups.get(key) ?? {
        city: b.pickupCity, country: b.pickupCountry, count: 0, totalRevenue: 0, latSum: 0, lngSum: 0, coordCount: 0,
      }
      existing.count++
      existing.totalRevenue += revenue
      if (b.pickupLat != null && b.pickupLng != null) {
        existing.latSum += b.pickupLat
        existing.lngSum += b.pickupLng
        existing.coordCount++
      }
      originGroups.set(key, existing)
    }

    if (hasCity(b.dropoffCity)) {
      const key = `${b.dropoffCity}|${b.dropoffCountry ?? ''}`
      const existing = destGroups.get(key) ?? {
        city: b.dropoffCity, country: b.dropoffCountry, count: 0, totalRevenue: 0, latSum: 0, lngSum: 0, coordCount: 0,
      }
      existing.count++
      existing.totalRevenue += revenue
      if (b.dropoffLat != null && b.dropoffLng != null) {
        existing.latSum += b.dropoffLat
        existing.lngSum += b.dropoffLng
        existing.coordCount++
      }
      destGroups.set(key, existing)
    }

    if (hasCity(b.pickupCity) && hasCity(b.dropoffCity)) {
      const key = `${b.pickupCity}|${b.pickupCountry ?? ''}→${b.dropoffCity}|${b.dropoffCountry ?? ''}`
      const existing = corridorGroups.get(key) ?? {
        originCity: b.pickupCity, originCountry: b.pickupCountry,
        destCity: b.dropoffCity, destCountry: b.dropoffCountry,
        count: 0, totalRevenue: 0, latSum: 0, lngSum: 0, coordCount: 0,
        requesterCounts: new Map<string, { city: string; country: string | null; count: number }>(),
      }
      existing.count++
      existing.totalRevenue += revenue
      if (hasCity(b.requesterCity)) {
        const rKey = `${b.requesterCity}|${b.requesterCountry ?? ''}`
        const rEntry = existing.requesterCounts.get(rKey) ?? { city: b.requesterCity, country: b.requesterCountry, count: 0 }
        rEntry.count++
        existing.requesterCounts.set(rKey, rEntry)
      }
      corridorGroups.set(key, existing)
    }
  }

  const corridors: RouteCorridor[] = Array.from(corridorGroups.values())
    .map((g) => {
      const origin = originGroups.get(`${g.originCity}|${g.originCountry ?? ''}`)
      const dest = destGroups.get(`${g.destCity}|${g.destCountry ?? ''}`)
      const originCentroid = origin ? centroid(origin) : { lat: null, lng: null }
      const destCentroid = dest ? centroid(dest) : { lat: null, lng: null }
      let topRequester: { city: string; country: string | null; count: number } | null = null
      for (const r of g.requesterCounts.values()) {
        if (!topRequester || r.count > topRequester.count) topRequester = r
      }
      return {
        originCity: g.originCity,
        originCountry: g.originCountry,
        destCity: g.destCity,
        destCountry: g.destCountry,
        count: g.count,
        totalRevenue: g.totalRevenue,
        avgFare: g.count > 0 ? g.totalRevenue / g.count : 0,
        originLat: originCentroid.lat,
        originLng: originCentroid.lng,
        destLat: destCentroid.lat,
        destLng: destCentroid.lng,
        topRequesterCity: topRequester?.city ?? null,
        topRequesterCountry: topRequester?.country ?? null,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)

  const toCityAggregate = (g: GroupAccumulator & { city: string; country: string | null }): CityAggregate => {
    const { lat, lng } = centroid(g)
    return { city: g.city, country: g.country, count: g.count, totalRevenue: g.totalRevenue, lat, lng }
  }

  const topOriginCities = Array.from(originGroups.values())
    .map(toCityAggregate)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)

  const topDestinationCities = Array.from(destGroups.values())
    .map(toCityAggregate)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)

  return { corridors, topOriginCities, topDestinationCities, pickupHeatmapPoints, dropoffHeatmapPoints, bySource }
}
