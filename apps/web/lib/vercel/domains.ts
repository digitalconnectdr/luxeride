// ── Dominio personalizado por empresa — API de dominios de Vercel ──────────
// Server-only. Requiere VERCEL_API_TOKEN (token con permiso sobre el
// proyecto) + VERCEL_PROJECT_ID, y VERCEL_TEAM_ID si el proyecto vive bajo
// un team (no una cuenta personal) — sin team_id, las llamadas a un proyecto
// de team fallan con 404/403.
//
// IMPORTANTE: los shapes de respuesta aquí siguen la documentación pública
// de Vercel (api.vercel.com, endpoints de "Domains"/"Projects"), pero — igual
// que otras integraciones nuevas de este proyecto (ver nota en
// app/api/webhooks/whop-connect/route.ts) — no se han confirmado todavía
// contra una llamada real. Antes de depender de esto en producción: agrega
// un dominio de prueba real y confirma que `verified`/`verification` llegan
// con esta forma exacta.

const VERCEL_API_BASE = 'https://api.vercel.com'

export function isVercelDomainsConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID)
}

function teamQuery(): string {
  return process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ''
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export interface VercelDomainVerificationRecord {
  type: string
  domain: string
  value: string
  reason?: string
}

export interface VercelDomainResult {
  ok: true
  verified: boolean
  verification: VercelDomainVerificationRecord[]
}

/** Agrega el dominio al proyecto de Vercel — no falla si ya está agregado. */
export async function addDomainToVercelProject(
  domain: string,
): Promise<VercelDomainResult | { ok: false; error: string }> {
  if (!isVercelDomainsConfigured()) return { ok: false, error: 'Vercel no está configurado' }

  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains${teamQuery()}`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name: domain }) },
    )
    const data = await res.json()
    if (!res.ok) {
      // Vercel devuelve 409 si el dominio ya está agregado a ESTE proyecto —
      // no es un error real, se trata como éxito (idempotente).
      if (res.status === 409) {
        return await getVercelDomainStatus(domain)
      }
      return { ok: false, error: data?.error?.message ?? `Error de Vercel (${res.status})` }
    }
    return { ok: true, verified: Boolean(data.verified), verification: data.verification ?? [] }
  } catch (err) {
    console.error('[addDomainToVercelProject]', err)
    return { ok: false, error: 'Error de red al conectar con Vercel' }
  }
}

/** Consulta el estado actual de verificación de un dominio ya agregado. */
export async function getVercelDomainStatus(
  domain: string,
): Promise<VercelDomainResult | { ok: false; error: string }> {
  if (!isVercelDomainsConfigured()) return { ok: false, error: 'Vercel no está configurado' }

  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain}${teamQuery()}`,
      { headers: authHeaders() },
    )
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.error?.message ?? `Error de Vercel (${res.status})` }
    return { ok: true, verified: Boolean(data.verified), verification: data.verification ?? [] }
  } catch (err) {
    console.error('[getVercelDomainStatus]', err)
    return { ok: false, error: 'Error de red al conectar con Vercel' }
  }
}

/** Quita el dominio del proyecto (al desconectar/cambiar de dominio). */
export async function removeDomainFromVercelProject(domain: string): Promise<{ ok: boolean }> {
  if (!isVercelDomainsConfigured()) return { ok: false }

  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${domain}${teamQuery()}`,
      { method: 'DELETE', headers: authHeaders() },
    )
    return { ok: res.ok || res.status === 404 }
  } catch (err) {
    console.error('[removeDomainFromVercelProject]', err)
    return { ok: false }
  }
}
