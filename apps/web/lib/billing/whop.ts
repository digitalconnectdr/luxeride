// ── Whop — facturación del acceso a la plataforma (Parte A) ────────────────────
// IMPORTANTE: el nombre exacto del header de firma y la forma del payload de
// Whop no se pudieron verificar en vivo al escribir esto (sin acceso a un
// evento real de su dashboard). Está implementado con la convención más común
// (HMAC-SHA256 sobre el body crudo, header `X-Whop-Signature`) y extracción
// DEFENSIVA de email/plan probando varias rutas plausibles del payload.
// Antes de depender de esto en producción: configura el webhook en el
// dashboard de Whop apuntando a /api/webhooks/whop, dispara un evento de
// prueba, y revisa los logs de Vercel — si `parseWhopEvent` no encuentra el
// email o el plan, el log de advertencia muestra el payload completo para
// ajustar las rutas de abajo.

import { createHmac, timingSafeEqual } from 'crypto'
import type { CompanyPlan } from '@/lib/supabase/database.types'

export function isWhopConfigured(): boolean {
  return !!process.env.WHOP_WEBHOOK_SECRET
}

/** Verificación HMAC-SHA256 genérica sobre el body crudo, en tiempo constante. */
export function verifyWhopSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expected)
  // El header puede venir como "sha256=<hex>" o solo "<hex>" según el proveedor.
  const received = signatureHeader.includes('=') ? signatureHeader.split('=').pop()! : signatureHeader
  const receivedBuf = Buffer.from(received)
  if (expectedBuf.length !== receivedBuf.length) return false
  return timingSafeEqual(expectedBuf, receivedBuf)
}

/** Mapea un plan/producto de Whop (env var) a nuestro CompanyPlan interno. */
export function mapWhopPlanId(whopPlanId: string | null): CompanyPlan | undefined {
  if (!whopPlanId) return undefined
  if (whopPlanId === process.env.WHOP_PLAN_ID_STARTER) return 'starter'
  if (whopPlanId === process.env.WHOP_PLAN_ID_PROFESSIONAL) return 'professional'
  if (whopPlanId === process.env.WHOP_PLAN_ID_ENTERPRISE) return 'enterprise'
  return undefined
}

export interface WhopParsedEvent {
  type: string
  email: string | null
  planId: string | null
  membershipId: string | null
}

function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function firstString(obj: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const v = pick(obj, path)
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** Extrae de forma defensiva email/plan/membership del payload de un evento de Whop. */
export function parseWhopEvent(body: unknown): WhopParsedEvent {
  const type = firstString(body, [['type'], ['event'], ['action']]) ?? 'unknown'
  const email = firstString(body, [
    ['data', 'user', 'email'],
    ['data', 'email'],
    ['data', 'customer', 'email'],
    ['email'],
  ])
  const planId = firstString(body, [
    ['data', 'plan_id'],
    ['data', 'plan', 'id'],
    ['data', 'product_id'],
    ['data', 'product', 'id'],
  ])
  const membershipId = firstString(body, [
    ['data', 'id'],
    ['data', 'membership_id'],
    ['id'],
  ])
  return { type, email, planId, membershipId }
}

/** Tipos de evento de Whop que consideramos "pago exitoso / membresía activa". */
const SUCCESS_EVENT_TYPES = new Set([
  'payment.succeeded',
  'membership.went_valid',
  'membership.created',
  'membership_went_valid',
])

export function isWhopSuccessEvent(eventType: string): boolean {
  return SUCCESS_EVENT_TYPES.has(eventType)
}
