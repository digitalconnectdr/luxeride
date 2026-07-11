// ── F1.17 — Rate limiting para endpoints públicos ─────────────────────────────
// Distribuido vía Upstash Redis cuando UPSTASH_REDIS_REST_URL/TOKEN están
// configurados (ventana fija INCR+PEXPIRE). Fallback a memoria por instancia
// si Redis no está configurado o falla — nunca bloquea por error de infra.

import { headers } from 'next/headers'
import { Redis } from '@upstash/redis'

// ─── Redis (lazy, placeholder-safe) ───────────────────────────────────────────

let redisSingleton: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton
  const url = process.env.UPSTASH_REDIS_REST_URL ?? ''
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? ''
  if (!url.startsWith('https://') || !token || token.includes('placeholder')) {
    redisSingleton = null
    return null
  }
  redisSingleton = new Redis({ url, token })
  return redisSingleton
}

// ─── Fallback en memoria ──────────────────────────────────────────────────────

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()
const MAX_BUCKETS = 10_000

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key)
  }
}

function checkInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  prune(now)

  const win = buckets.get(key)
  if (!win || win.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  win.count += 1
  return win.count <= limit
}

// ─── API ──────────────────────────────────────────────────────────────────────

/** IP del cliente desde los headers del proxy (Vercel setea x-forwarded-for). */
export function getClientIp(): string {
  const h = headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'unknown'
}

/**
 * true si la petición está dentro del límite; false si debe rechazarse.
 * @param action  nombre lógico del endpoint ('public_quote', 'login', …)
 * @param limit   peticiones permitidas por ventana
 * @param windowMs duración de la ventana en ms (default 60s)
 */
export async function checkRateLimit(
  action: string,
  limit: number,
  windowMs = 60_000,
): Promise<boolean> {
  const key = `rl:${action}:${getClientIp()}`

  const redis = getRedis()
  if (redis) {
    try {
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.pexpire(key, windowMs)
      }
      return count <= limit
    } catch (err) {
      console.error('[rate-limit] Redis error | usando fallback en memoria', err)
    }
  }

  return checkInMemory(key, limit, windowMs)
}

export const RATE_LIMIT_ERROR =
  'Demasiadas solicitudes. Espera un momento e intenta de nuevo.'
