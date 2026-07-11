import type { createAdminClient } from '@/lib/supabase/server'

// ── QuickBooks Online — servidor unicamente ────────────────────────────────────
// Cada operador conecta SU PROPIA cuenta de QuickBooks Online (mismo espiritu
// que Stripe Connect / Whop Connect: nadie comparte credenciales), pero el
// mecanismo es distinto porque QBO no permite crear sub-cuentas desde una key
// de plataforma unica — requiere OAuth2 real por empresa. Por eso, a
// diferencia de companies.stripe_connect_account_id/whop_connect_company_id
// (solo un ID de cuenta, la key que autoriza es la de la plataforma), aqui SI
// se guarda un access_token/refresh_token por empresa en companies.
//
// Variables de entorno requeridas (crear una app en developer.intuit.com):
// - QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET
// - QUICKBOOKS_ENVIRONMENT: 'sandbox' | 'production' (default 'sandbox')
//
// Validado en vivo (2026-07-11): el usuario conecto su app real de
// developer.intuit.com contra su Sandbox Company y "Sincronizar ahora"
// genero correctamente un Sales Receipt con el monto y pasajero exactos de
// una reserva completada — el flujo completo (OAuth, creacion de
// cliente/item, Sales Receipt) esta confirmado contra una cuenta real de
// QuickBooks, no solo contra la documentacion publica de la API v3.
// Nota: el matching de Customer es por DisplayName EXACTO (sensible a
// mayusculas) — passenger_name con distinta capitalizacion entre reservas
// crea un Customer separado por variante en QBO; simplificacion consciente
// del MVP, sin normalizacion/fuzzy-match de nombres todavia.

const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const SCOPE = 'com.intuit.quickbooks.accounting'

// Margen antes de que expire el access_token (dura 1h) para forzar refresh.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000

export interface QuickBooksTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export function isQuickBooksConfigured(): boolean {
  return !!process.env.QUICKBOOKS_CLIENT_ID && !!process.env.QUICKBOOKS_CLIENT_SECRET
}

function getEnvironment(): 'sandbox' | 'production' {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

export function getApiBaseUrl(): string {
  return getEnvironment() === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

function basicAuthHeader(): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID ?? ''
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET ?? ''
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`
}

/** URL de autorizacion de Intuit a la que se redirige al operador. */
export function buildAuthorizeUrl(opts: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.QUICKBOOKS_CLIENT_ID ?? '',
    response_type: 'code',
    scope: SCOPE,
    redirect_uri: opts.redirectUri,
    state: opts.state,
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

/** Intercambia el `code` del callback OAuth por access_token/refresh_token. */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<QuickBooksTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`QuickBooks token exchange failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  }
}

/** Renueva el access_token. El refresh_token ROTA en cada uso — hay que persistir el nuevo. */
async function refreshTokens(refreshToken: string): Promise<QuickBooksTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`QuickBooks token refresh failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  }
}

export interface QuickBooksConnection {
  accessToken: string
  realmId: string
}

/**
 * Devuelve un access_token utilizable para la empresa, renovandolo (y
 * persistiendo el par nuevo) si esta por expirar. Devuelve null si la
 * empresa no tiene QuickBooks conectado.
 */
export async function getValidConnection(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
): Promise<QuickBooksConnection | null> {
  const { data: company } = await admin
    .from('companies')
    .select('quickbooks_realm_id, quickbooks_access_token, quickbooks_refresh_token, quickbooks_token_expires_at')
    .eq('id', companyId)
    .single()

  if (!company?.quickbooks_realm_id || !company.quickbooks_access_token || !company.quickbooks_refresh_token) {
    return null
  }

  const expiresAt = company.quickbooks_token_expires_at ? new Date(company.quickbooks_token_expires_at).getTime() : 0
  if (expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return { accessToken: company.quickbooks_access_token, realmId: company.quickbooks_realm_id }
  }

  const tokens = await refreshTokens(company.quickbooks_refresh_token)
  await admin
    .from('companies')
    .update({
      quickbooks_access_token: tokens.accessToken,
      quickbooks_refresh_token: tokens.refreshToken,
      quickbooks_token_expires_at: tokens.expiresAt,
    })
    .eq('id', companyId)

  return { accessToken: tokens.accessToken, realmId: company.quickbooks_realm_id }
}

/** Llamada de bajo nivel a la API contable de QBO (v3) para una empresa ya conectada. */
export async function qboFetch(
  connection: QuickBooksConnection,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = `${getApiBaseUrl()}/v3/company/${connection.realmId}/${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) throw new Error(`QuickBooks API error ${res.status} on ${path}: ${await res.text()}`)
  return res.json()
}

/** Escapa comillas simples para armar un query de la Query API de QBO (SELECT ...). */
export function escapeQboQueryValue(value: string): string {
  return value.replace(/'/g, "\\'")
}
