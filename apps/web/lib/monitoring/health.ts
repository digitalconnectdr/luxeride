// ── Monitoreo de sistema (panel /super-admin/system) ──────────────────────────
// Cada check corre solo bajo demanda (botón "Verificar ahora") o desde el cron
// protegido — nunca en un loop constante — para no agregar carga permanente.
// Dos estrategias según el servicio:
//  1) Ping barato en vivo (Supabase, la propia URL de Vercel, Twilio, Resend,
//     Stripe) — todas estas tienen un endpoint de lectura gratis/casi gratis.
//  2) Proxy por "último uso real exitoso" (Google Maps, OpenAI, AeroDataBox) —
//     estos SÍ cobran por llamada, así que en vez de hacerles ping se lee la
//     marca de tiempo de la última vez que un usuario real los usó con éxito
//     (una cotización, un mensaje de IA, una consulta de vuelo). Si nunca se
//     ha usado o hace mucho que no se usa, se reporta 'unknown', no 'down' —
//     no tenemos evidencia de que esté caído, solo de que nadie lo ha probado.

import { createAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { isResendConfigured, isTwilioConfigured } from '@/lib/notifications'
import { isStripeConfigured, getStripe } from '@/lib/stripe/server'
import { isWhopConnectConfigured } from '@/lib/whop/connect-server'

export type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown'

export const SERVICE_LABELS: Record<string, string> = {
  supabase: 'Supabase (base de datos)',
  db_capacity: 'Capacidad de la base de datos',
  vercel: 'Vercel (la app en producción)',
  gps_tracking: 'GPS / tracking en vivo',
  twilio: 'Twilio (SMS)',
  resend: 'Resend (email)',
  stripe: 'Stripe',
  whop: 'Whop',
  google_maps: 'Google Maps',
  openai: 'Asistente IA (OpenAI)',
  flight_tracking: 'Tracking de vuelos',
}

export interface HealthCheckResult {
  service: string
  status: HealthStatus
  message?: string
  responseMs?: number
  meta?: Record<string, unknown>
}

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const t0 = Date.now()
  try {
    const value = await fn()
    return { ms: Date.now() - t0, value }
  } catch (err) {
    return { ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) }
  }
}

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
}

// ─── Supabase (base de datos) ──────────────────────────────────────────────

export async function checkSupabase(): Promise<HealthCheckResult> {
  const admin = createAdminClient()
  const { ms, error } = await timeIt(async () => {
    const { error: qErr } = await admin.from('companies').select('id', { count: 'exact', head: true })
    if (qErr) throw new Error(qErr.message)
  })
  if (error) return { service: 'supabase', status: 'down', message: error, responseMs: ms }
  return {
    service: 'supabase',
    status: ms > 3000 ? 'degraded' : 'ok',
    message: ms > 3000 ? 'Respondió, pero lento' : undefined,
    responseMs: ms,
  }
}

// ─── Capacidad de la base de datos (bytes usados vs límite del plan) ───────

export async function checkDatabaseCapacity(): Promise<HealthCheckResult> {
  const admin = createAdminClient()
  const { ms, value, error } = await timeIt(async () => {
    // database.types.ts no mantiene tipos de Functions (proyecto sin
    // typegen automático) — cast puntual, igual que el resto del cliente
    // admin ya está sin tipar más allá de las tablas.
    const { data, error: rpcErr } = await (admin as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('get_database_size_bytes')
    if (rpcErr) throw new Error(rpcErr.message)
    return data as unknown as number
  })
  if (error || value === undefined) {
    return { service: 'db_capacity', status: 'unknown', message: error, responseMs: ms }
  }
  const usedBytes = Number(value)
  const limitGb = Number(process.env.SUPABASE_STORAGE_LIMIT_GB ?? '8')
  const limitBytes = limitGb * 1024 ** 3
  const pctUsed = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0
  return {
    service: 'db_capacity',
    status: pctUsed >= 90 ? 'down' : pctUsed >= 75 ? 'degraded' : 'ok',
    message: pctUsed >= 75 ? `${pctUsed.toFixed(1)}% de la capacidad configurada (${limitGb} GB)` : undefined,
    responseMs: ms,
    meta: { usedBytes, limitBytes, limitGb, pctUsed },
  }
}

// ─── Vercel (la propia app respondiendo) ───────────────────────────────────

export async function checkVercel(): Promise<HealthCheckResult> {
  const { ms, value, error } = await timeIt(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(getAppUrl(), { method: 'GET', signal: controller.signal, cache: 'no-store' })
      return res.status
    } finally {
      clearTimeout(timeout)
    }
  })
  if (error) return { service: 'vercel', status: 'down', message: error, responseMs: ms }
  const status = value ?? 0
  return {
    service: 'vercel',
    status: status >= 500 ? 'down' : status >= 400 ? 'degraded' : ms > 5000 ? 'degraded' : 'ok',
    message: status >= 400 ? `HTTP ${status}` : ms > 5000 ? 'Respondió, pero lento' : undefined,
    responseMs: ms,
    meta: { httpStatus: status },
  }
}

// ─── GPS / tracking en vivo — basado en datos propios, sin llamar a nada
// externo. "Caído" no significa que el servicio esté roto, sino que hay
// viajes activos cuyo conductor dejó de reportar posición hace rato (el
// síntoma real que ve un pasajero como "se congeló el mapa"). ──────────────

const GPS_STALE_MINUTES = 5

export async function checkGpsTracking(): Promise<HealthCheckResult> {
  const admin = createAdminClient()
  const { ms, value, error } = await timeIt(async () => {
    const { data: activeBookings, error: bErr } = await admin
      .from('bookings')
      .select('id')
      .eq('status', 'in_progress')
    if (bErr) throw new Error(bErr.message)
    const activeIds = (activeBookings ?? []).map((b) => b.id)
    if (activeIds.length === 0) return { active: 0, stale: 0 }

    const cutoff = new Date(Date.now() - GPS_STALE_MINUTES * 60_000).toISOString()
    const { data: fresh, error: lErr } = await admin
      .from('trip_locations')
      .select('booking_id')
      .in('booking_id', activeIds)
      .eq('reporter', 'driver')
      .gte('recorded_at', cutoff)
    if (lErr) throw new Error(lErr.message)
    const freshIds = new Set((fresh ?? []).map((r) => r.booking_id))
    return { active: activeIds.length, stale: activeIds.length - freshIds.size }
  })
  if (error || !value) return { service: 'gps_tracking', status: 'unknown', message: error, responseMs: ms }

  const { active, stale } = value
  if (active === 0) {
    return { service: 'gps_tracking', status: 'ok', message: 'Sin viajes activos ahora mismo', responseMs: ms, meta: { active, stale } }
  }
  const staleRatio = stale / active
  return {
    service: 'gps_tracking',
    status: staleRatio >= 0.5 ? 'down' : staleRatio > 0 ? 'degraded' : 'ok',
    message: stale > 0 ? `${stale} de ${active} viaje(s) activo(s) sin posición reciente (>${GPS_STALE_MINUTES} min)` : undefined,
    responseMs: ms,
    meta: { active, stale },
  }
}

// ─── Twilio (SMS) — fetch de cuenta, no envía nada, sin costo ──────────────

export async function checkTwilio(): Promise<HealthCheckResult> {
  if (!isTwilioConfigured()) return { service: 'twilio', status: 'unknown', message: 'No configurado' }
  const { ms, error } = await timeIt(async () => {
    const twilio = (await import('twilio')).default
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
    await client.api.v2010.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch()
  })
  if (error) return { service: 'twilio', status: 'down', message: error, responseMs: ms }
  return { service: 'twilio', status: 'ok', responseMs: ms }
}

// ─── Resend (email) — lista de dominios, no envía nada, sin costo ─────────

export async function checkResend(): Promise<HealthCheckResult> {
  if (!isResendConfigured()) return { service: 'resend', status: 'unknown', message: 'No configurado' }
  const { ms, error } = await timeIt(async () => {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY!)
    const { error: rErr } = await resend.domains.list()
    if (rErr) throw new Error(rErr.message)
  })
  if (error) return { service: 'resend', status: 'down', message: error, responseMs: ms }
  return { service: 'resend', status: 'ok', responseMs: ms }
}

// ─── Stripe — balance.retrieve(), lectura pura, sin costo ──────────────────

export async function checkStripe(): Promise<HealthCheckResult> {
  if (!isStripeConfigured()) return { service: 'stripe', status: 'unknown', message: 'No configurado' }
  const { ms, error } = await timeIt(async () => {
    const stripe = getStripe()
    if (!stripe) throw new Error('Cliente no disponible')
    await stripe.balance.retrieve()
  })
  if (error) return { service: 'stripe', status: 'down', message: error, responseMs: ms }
  return { service: 'stripe', status: 'ok', responseMs: ms }
}

// ─── Whop — solo se confirma que las credenciales están configuradas; el SDK
// no expone un endpoint de "ping" verificado, así que no se arriesga una
// llamada en vivo a un método sin confirmar contra la documentación real. ──

export async function checkWhop(): Promise<HealthCheckResult> {
  if (!isWhopConnectConfigured()) return { service: 'whop', status: 'unknown', message: 'No configurado' }
  return { service: 'whop', status: 'ok', message: 'Credenciales configuradas (sin ping en vivo)' }
}

// ─── Google Maps — proxy vía la última cotización real generada (no se le
// hace ping activo: cada llamada de prueba costaría dinero real). ──────────

export async function checkGoogleMapsUsage(): Promise<HealthCheckResult> {
  const admin = createAdminClient()
  const { ms, value, error } = await timeIt(async () => {
    const { data, error: qErr } = await admin
      .from('price_quotes')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (qErr) throw new Error(qErr.message)
    return data?.created_at ?? null
  })
  if (error) return { service: 'google_maps', status: 'unknown', message: error, responseMs: ms }
  const mins = minutesSince(value)
  if (mins === null) return { service: 'google_maps', status: 'unknown', message: 'Sin cotizaciones registradas todavía', responseMs: ms }
  return {
    service: 'google_maps',
    status: mins > 1440 ? 'degraded' : 'ok',
    message: mins > 1440 ? `Última cotización exitosa hace ${Math.round(mins / 60)}h` : undefined,
    responseMs: ms,
    meta: { lastSuccessMinutesAgo: mins },
  }
}

// ─── Asistente IA (OpenAI) — proxy vía el último mensaje de chat generado ──

export async function checkAiUsage(): Promise<HealthCheckResult> {
  const admin = createAdminClient()
  const { ms, value, error } = await timeIt(async () => {
    const { data, error: qErr } = await admin
      .from('ai_chat_messages')
      .select('created_at')
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (qErr) throw new Error(qErr.message)
    return data?.created_at ?? null
  })
  if (error) return { service: 'openai', status: 'unknown', message: error, responseMs: ms }
  const mins = minutesSince(value)
  if (mins === null) return { service: 'openai', status: 'unknown', message: 'Sin uso registrado todavía', responseMs: ms }
  return {
    service: 'openai',
    status: 'ok',
    responseMs: ms,
    meta: { lastSuccessMinutesAgo: mins },
  }
}

// ─── Tracking de vuelos (AeroDataBox/FlightAware) — proxy vía consumo del
// mes actual, ya contado por lib/flights/quota.ts. ──────────────────────────

export async function checkFlightTracking(): Promise<HealthCheckResult> {
  const admin = createAdminClient()
  const yearMonth = new Date().toISOString().slice(0, 7)
  const { ms, value, error } = await timeIt(async () => {
    const { data, error: qErr } = await admin
      .from('flight_tracking_usage')
      .select('lookup_count')
      .eq('year_month', yearMonth)
    if (qErr) throw new Error(qErr.message)
    return (data ?? []).reduce((sum, r) => sum + r.lookup_count, 0)
  })
  if (error) return { service: 'flight_tracking', status: 'unknown', message: error, responseMs: ms }
  return {
    service: 'flight_tracking',
    status: 'ok',
    message: value ? `${value} consulta(s) este mes` : 'Sin consultas este mes',
    responseMs: ms,
    meta: { lookupsThisMonth: value ?? 0 },
  }
}

// ─── Corre todos los chequeos en paralelo, cada uno aislado (uno que falle
// no tumba a los demás). ────────────────────────────────────────────────────

export async function runAllHealthChecks(): Promise<HealthCheckResult[]> {
  const checks = [
    checkSupabase,
    checkDatabaseCapacity,
    checkVercel,
    checkGpsTracking,
    checkTwilio,
    checkResend,
    checkStripe,
    checkWhop,
    checkGoogleMapsUsage,
    checkAiUsage,
    checkFlightTracking,
  ]
  const results = await Promise.all(
    checks.map(async (fn) => {
      try {
        return await fn()
      } catch (err) {
        return { service: fn.name, status: 'unknown' as HealthStatus, message: err instanceof Error ? err.message : String(err) }
      }
    }),
  )
  return results
}
