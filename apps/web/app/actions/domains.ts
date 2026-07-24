'use server'
// ── Dominio personalizado por empresa ──────────────────────────────────────
// Dos caminos que terminan en el mismo lugar (companies.custom_domain
// verificado vía la API de Vercel, ver lib/vercel/domains.ts), pero con
// modelos de cobro DISTINTOS (aclaración de negocio 2026-07-24 — ver
// lib/billing/custom-domain-addon.ts):
// (a) BYOD — el operador ya tiene dominio, lo agrega él mismo
//     (addCustomDomainAction). Gateado por un cargo ÚNICO
//     (custom_domain_byod, incluido en Elite/Enterprise) — no hay costo
//     continuo para LuxeRide, el dominio lo sigue pagando el operador.
// (b) Sin dominio — pide que se lo consigan (submitDomainRequestAction),
//     gateado por la cuota MENSUAL (custom_domain) porque ahí sí LuxeRide
//     compra y renueva el dominio. El super-admin lo COMPRA MANUALMENTE
//     fuera del sistema (dinero real, no hay integración de compra) y entra
//     el dominio real comprado (resolveDomainRequestAction), que reusa el
//     mismo connectDomainToCompany.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import {
  addDomainToVercelProject,
  getVercelDomainStatus,
  removeDomainFromVercelProject,
} from '@/lib/vercel/domains'
import { isCustomDomainAddonActive, isCustomDomainByodActive } from '@/lib/billing/custom-domain-addon'
import type { DomainRequestStatus } from '@/lib/supabase/database.types'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i

export interface DomainConnectionResult {
  verified: boolean
  verification: { type: string; domain: string; value: string; reason?: string }[]
}

/** Núcleo compartido: agrega el dominio en Vercel + lo guarda en companies. */
async function connectDomainToCompany(
  companyId: string,
  domain: string,
): Promise<ActionResult<DomainConnectionResult>> {
  const clean = domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(clean)) return { success: false, error: 'Dominio inválido' }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('companies')
    .select('id')
    .eq('custom_domain', clean)
    .maybeSingle()
  if (existing && existing.id !== companyId) {
    return { success: false, error: 'Ese dominio ya está en uso por otra empresa' }
  }

  const result = await addDomainToVercelProject(clean)
  if (!result.ok) return { success: false, error: result.error }

  const { error } = await admin
    .from('companies')
    .update({
      custom_domain: clean,
      custom_domain_status: result.verified ? 'verified' : 'pending_verification',
      custom_domain_added_at: new Date().toISOString(),
    })
    .eq('id', companyId)
  if (error) {
    console.error('[connectDomainToCompany]', error)
    return { success: false, error: 'Error al guardar el dominio' }
  }

  revalidatePath('/admin/domain')
  return { success: true, data: { verified: result.verified, verification: result.verification } }
}

// ─── Operador (BYOD) ───────────────────────────────────────────────────────

export async function addCustomDomainAction(domain: string): Promise<ActionResult<DomainConnectionResult>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const [{ data: company }, { data: rows }] = await Promise.all([
    admin.from('companies').select('plan').eq('id', user.company_id).single(),
    admin.from('company_addons').select('addon_key').eq('company_id', user.company_id).eq('enabled', true),
  ])
  const enabledKeys = new Set((rows ?? []).map((r) => r.addon_key))
  if (!company || !isCustomDomainByodActive(company.plan, enabledKeys)) {
    return { success: false, error: 'Activa el cargo único de conexión de dominio primero' }
  }

  return connectDomainToCompany(user.company_id, domain)
}

export async function checkCustomDomainStatusAction(): Promise<ActionResult<DomainConnectionResult>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('custom_domain')
    .eq('id', user.company_id)
    .single()
  if (!company?.custom_domain) return { success: false, error: 'No hay dominio configurado' }

  const result = await getVercelDomainStatus(company.custom_domain)
  if (!result.ok) return { success: false, error: result.error }

  await admin
    .from('companies')
    .update({ custom_domain_status: result.verified ? 'verified' : 'pending_verification' })
    .eq('id', user.company_id)

  revalidatePath('/admin/domain')
  return { success: true, data: { verified: result.verified, verification: result.verification } }
}

export async function removeCustomDomainAction(): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('custom_domain')
    .eq('id', user.company_id)
    .single()
  if (company?.custom_domain) {
    await removeDomainFromVercelProject(company.custom_domain)
  }

  const { error } = await admin
    .from('companies')
    .update({ custom_domain: null, custom_domain_status: null, custom_domain_added_at: null })
    .eq('id', user.company_id)
  if (error) return { success: false, error: 'Error al quitar el dominio' }

  revalidatePath('/admin/domain')
  return { success: true }
}

export async function submitDomainRequestAction(requestedName: string, notes?: string): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('company_addons')
    .select('addon_key')
    .eq('company_id', user.company_id)
    .eq('enabled', true)
  const enabledKeys = new Set((rows ?? []).map((r) => r.addon_key))
  if (!isCustomDomainAddonActive(enabledKeys)) {
    return { success: false, error: 'Activa el add-on de dominio personalizado primero' }
  }

  const clean = requestedName.trim()
  if (!clean) return { success: false, error: 'Escribe el nombre que te gustaría para tu dominio' }

  const { error } = await admin.from('domain_requests').insert({
    company_id: user.company_id,
    requested_by: user.id,
    requested_name: clean,
    notes: notes?.trim() || null,
  })
  if (error) {
    console.error('[submitDomainRequestAction]', error)
    return { success: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  revalidatePath('/admin/domain')
  return { success: true }
}

// ─── Super-admin (compra manual + resolución) ─────────────────────────────

export interface DomainRequestRow {
  id: string
  company_id: string
  company_name: string
  requested_name: string
  notes: string | null
  status: DomainRequestStatus
  resolved_domain: string | null
  created_at: string
}

export async function listDomainRequestsAction(): Promise<DomainRequestRow[]> {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { data } = await admin
    .from('domain_requests')
    .select('id, company_id, requested_name, notes, status, resolved_domain, created_at, companies(name)')
    .order('created_at', { ascending: false })

  return ((data ?? []) as unknown as (Omit<DomainRequestRow, 'company_name'> & { companies: { name: string } | null })[]).map(
    (r) => ({ ...r, company_name: r.companies?.name ?? 'Empresa eliminada' }),
  )
}

export async function resolveDomainRequestAction(
  requestId: string,
  action: 'purchased' | 'rejected',
  purchasedDomain?: string,
): Promise<ActionResult> {
  const user = await requireRole('super_admin')

  const admin = createAdminClient()
  const { data: request } = await admin
    .from('domain_requests')
    .select('id, company_id, status')
    .eq('id', requestId)
    .single()
  if (!request) return { success: false, error: 'Solicitud no encontrada' }
  if (request.status !== 'pending') return { success: false, error: 'Esta solicitud ya fue resuelta' }

  if (action === 'purchased') {
    if (!purchasedDomain?.trim()) return { success: false, error: 'Falta el dominio que compraste' }
    const connect = await connectDomainToCompany(request.company_id, purchasedDomain)
    if (!connect.success) return { success: false, error: connect.error }

    await admin
      .from('domain_requests')
      .update({
        status: 'purchased',
        resolved_domain: purchasedDomain.trim().toLowerCase(),
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', requestId)
  } else {
    await admin
      .from('domain_requests')
      .update({ status: 'rejected', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', requestId)
  }

  revalidatePath('/super-admin/domains')
  return { success: true }
}
