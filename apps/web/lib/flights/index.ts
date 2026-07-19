// ── Flight Tracking — proveedores con failover automático ─────────────────────
// FLIGHT_PROVIDER=aerodatabox (RapidAPI, tier gratis) | flightaware (AeroAPI)
// elige cuál va PRIMERO. Si ambas keys (RAPIDAPI_KEY y FLIGHTAWARE_API_KEY)
// están configuradas, el otro proveedor queda como respaldo automático: si el
// primero falla de verdad (error de red, HTTP 5xx/429), se reintenta con el
// segundo antes de rendirse -- un vuelo genuinamente no encontrado (404/204)
// NO dispara el respaldo, solo los fallos reales de la API. Placeholder-safe:
// sin ninguna key, isFlightTrackingConfigured() = false y el sistema opera
// sin tracking.

export interface FlightStatus {
  flightNumber: string
  /** scheduled | enroute | delayed | arrived | cancelled | unknown */
  status: string
  scheduledArrival: string | null // ISO UTC
  estimatedArrival: string | null // ISO UTC
  delayMinutes: number | null
  originIata: string | null
  destinationIata: string | null
  airline: string | null
}

type Provider = 'aerodatabox' | 'flightaware'

/** Lanzada por los adapters cuando la API falla de verdad (red/5xx/429) --
 * distinta de "vuelo no encontrado", que se representa con `null`. Solo este
 * error dispara el intento con el proveedor de respaldo. */
class FlightProviderError extends Error {}

// Orden de proveedores a intentar: el preferido explícito primero (si tiene
// key), luego cualquier otro proveedor configurado como respaldo.
function configuredProviders(): Provider[] {
  const explicit = (process.env.FLIGHT_PROVIDER ?? '').toLowerCase()
  const hasRapid = isRealKey(process.env.RAPIDAPI_KEY)
  const hasFa = isRealKey(process.env.FLIGHTAWARE_API_KEY)

  const order: Provider[] = []
  if (explicit === 'flightaware' && hasFa) order.push('flightaware')
  if (explicit === 'aerodatabox' && hasRapid) order.push('aerodatabox')
  if (!order.includes('aerodatabox') && hasRapid) order.push('aerodatabox')
  if (!order.includes('flightaware') && hasFa) order.push('flightaware')
  return order
}

function isRealKey(key: string | undefined): boolean {
  return !!key && key.length >= 20 && !key.toLowerCase().includes('placeholder')
}

export function isFlightTrackingConfigured(): boolean {
  return configuredProviders().length > 0
}

/** Normaliza "AA 1234" / "aa1234" → "AA1234" */
export function normalizeFlightNumber(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

// ─── Cache en memoria (por instancia) — evita consultas duplicadas ────────────

const cache = new Map<string, { data: FlightStatus | null; expiresAt: number }>()
const CACHE_TTL_MS = 25 * 60_000

/**
 * Estado del vuelo más cercano a la fecha actual para un número de vuelo.
 * Devuelve null si no hay proveedor configurado, el vuelo no se encuentra
 * o la API falla — NUNCA lanza.
 */
export async function getFlightStatus(rawFlightNumber: string): Promise<FlightStatus | null> {
  const providers = configuredProviders()
  if (providers.length === 0) return null

  const flightNumber = normalizeFlightNumber(rawFlightNumber)
  if (!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(flightNumber)) return null

  const cached = cache.get(flightNumber)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  let result: FlightStatus | null = null
  for (const provider of providers) {
    try {
      result =
        provider === 'aerodatabox'
          ? await fetchAeroDataBox(flightNumber)
          : await fetchFlightAware(flightNumber)
      break // encontrado o genuinamente no encontrado -- no hace falta el respaldo
    } catch (err) {
      console.error(`[flights/${provider}] ${flightNumber} — falló, ¿probando respaldo?`, err)
      // sigue al próximo proveedor configurado, si hay uno
    }
  }

  cache.set(flightNumber, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}

// ─── Adapter: AeroDataBox (RapidAPI) ──────────────────────────────────────────

interface AdbTime {
  utc?: string
  local?: string
}

interface AdbLeg {
  status?: string
  number?: string
  airline?: { name?: string }
  departure?: { airport?: { iata?: string }; scheduledTime?: AdbTime; revisedTime?: AdbTime }
  arrival?: {
    airport?: { iata?: string }
    scheduledTime?: AdbTime
    revisedTime?: AdbTime
    predictedTime?: AdbTime
  }
}

function adbToIso(t: AdbTime | undefined): string | null {
  const raw = t?.utc
  if (!raw) return null
  // AeroDataBox: "2026-06-11 14:35Z" → ISO
  const iso = raw.replace(' ', 'T')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const ADB_STATUS: Record<string, string> = {
  expected: 'scheduled',
  enroute: 'enroute',
  checkin: 'scheduled',
  boarding: 'scheduled',
  gateclosed: 'scheduled',
  departed: 'enroute',
  delayed: 'delayed',
  approaching: 'enroute',
  arrived: 'arrived',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  diverted: 'delayed',
  canceleduncertain: 'unknown',
}

async function fetchAeroDataBox(flightNumber: string): Promise<FlightStatus | null> {
  let res: Response
  try {
    res = await fetch(
      `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNumber)}?withAircraftImage=false&withLocation=false`,
      {
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
          'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
        },
        cache: 'no-store',
      },
    )
  } catch (err) {
    throw new FlightProviderError(`network error: ${err}`)
  }

  if (res.status === 404 || res.status === 204) return null
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new FlightProviderError(`HTTP ${res.status}: ${body}`)
  }

  const legs = (await res.json()) as AdbLeg[]
  if (!Array.isArray(legs) || legs.length === 0) return null

  // El leg más relevante: el primero no aterrizado, o el último
  const leg =
    legs.find((l) => !['arrived', 'canceled', 'cancelled'].includes((l.status ?? '').toLowerCase())) ??
    legs[legs.length - 1]!

  const scheduled = adbToIso(leg.arrival?.scheduledTime)
  const estimated =
    adbToIso(leg.arrival?.revisedTime) ?? adbToIso(leg.arrival?.predictedTime) ?? scheduled

  let delay: number | null = null
  if (scheduled && estimated) {
    delay = Math.round((new Date(estimated).getTime() - new Date(scheduled).getTime()) / 60_000)
  }

  return {
    flightNumber,
    status: ADB_STATUS[(leg.status ?? '').toLowerCase()] ?? 'unknown',
    scheduledArrival: scheduled,
    estimatedArrival: estimated,
    delayMinutes: delay,
    originIata: leg.departure?.airport?.iata ?? null,
    destinationIata: leg.arrival?.airport?.iata ?? null,
    airline: leg.airline?.name ?? null,
  }
}

// ─── Adapter: FlightAware AeroAPI ─────────────────────────────────────────────

interface FaFlight {
  status?: string
  cancelled?: boolean
  scheduled_in?: string
  estimated_in?: string
  actual_in?: string
  arrival_delay?: number // segundos
  origin?: { code_iata?: string }
  destination?: { code_iata?: string }
  operator?: string
  progress_percent?: number
}

async function fetchFlightAware(flightNumber: string): Promise<FlightStatus | null> {
  let res: Response
  try {
    res = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(flightNumber)}`,
      {
        headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY! },
        cache: 'no-store',
      },
    )
  } catch (err) {
    throw new FlightProviderError(`network error: ${err}`)
  }

  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new FlightProviderError(`HTTP ${res.status}: ${body}`)
  }

  const data = (await res.json()) as { flights?: FaFlight[] }
  const flights = data.flights ?? []
  if (flights.length === 0) return null

  const flight =
    flights.find((f) => !f.actual_in && !f.cancelled) ?? flights[0]!

  const delaySec = flight.arrival_delay ?? null
  let status = 'scheduled'
  if (flight.cancelled) status = 'cancelled'
  else if (flight.actual_in) status = 'arrived'
  else if ((flight.progress_percent ?? 0) > 0) status = 'enroute'
  else if (delaySec != null && delaySec >= 900) status = 'delayed'

  return {
    flightNumber,
    status,
    scheduledArrival: flight.scheduled_in ?? null,
    estimatedArrival: flight.estimated_in ?? flight.actual_in ?? flight.scheduled_in ?? null,
    delayMinutes: delaySec != null ? Math.round(delaySec / 60) : null,
    originIata: flight.origin?.code_iata ?? null,
    destinationIata: flight.destination?.code_iata ?? null,
    airline: flight.operator ?? null,
  }
}
