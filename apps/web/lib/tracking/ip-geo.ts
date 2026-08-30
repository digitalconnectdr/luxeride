// ── Geolocalización de IP → ciudad (para el mapa de visitantes) ────────────
// Usa ipwho.is: gratuito, sin API key, HTTPS. Solo se conservan los campos
// derivados (ciudad/región/país/coordenadas) - la IP nunca se persiste en
// la base de datos (ver app/api/track/visit/route.ts).

export interface IpGeo {
  city: string | null
  region: string | null
  country: string | null
  countryCode: string | null
  lat: number | null
  lng: number | null
}

const PRIVATE_IPS = new Set(['127.0.0.1', '::1'])

export async function resolveIpGeo(ip: string): Promise<IpGeo | null> {
  if (!ip || PRIVATE_IPS.has(ip)) return null

  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      success?: boolean
      city?: string
      region?: string
      country?: string
      country_code?: string
      latitude?: number
      longitude?: number
    }
    if (!data.success) return null

    return {
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country ?? null,
      countryCode: data.country_code ?? null,
      lat: typeof data.latitude === 'number' ? data.latitude : null,
      lng: typeof data.longitude === 'number' ? data.longitude : null,
    }
  } catch {
    return null
  }
}
