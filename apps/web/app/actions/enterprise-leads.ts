'use server'
// ── Leads del plan Enterprise ──────────────────────────────────────────────────
// El plan Enterprise es venta consultiva (precio "a medida", sin checkout de
// Whop) — el operador solicita contacto desde Configuración y el super-admin
// gestiona el lead desde /super-admin/enterprise-leads.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { EnterpriseLeadStatus } from '@/lib/supabase/database.types'

export type EnterpriseLeadResult = { success: boolean; error?: string }

export async function submitEnterpriseLeadAction(formData: FormData): Promise<EnterpriseLeadResult> {
  const user = await requireRole('company_owner', 'company_admin')

  const companyName = (formData.get('company_name') as string ?? '').trim()
  const contactName = (formData.get('contact_name') as string ?? '').trim()
  const email        = (formData.get('email') as string ?? '').trim()
  const phone        = (formData.get('phone') as string ?? '').trim()
  const fleetSize    = (formData.get('fleet_size') as string ?? '').trim() || null
  const message      = (formData.get('message') as string ?? '').trim() || null

  if (!companyName) return { success: false, error: 'Nombre de la empresa requerido' }
  if (!contactName) return { success: false, error: 'Nombre de contacto requerido' }
  if (!email)        return { success: false, error: 'Email requerido' }
  if (!phone)         return { success: false, error: 'Teléfono requerido' }

  const admin = createAdminClient()
  const { error } = await admin.from('enterprise_leads').insert({
    company_id:   user.company_id,
    requested_by: user.id,
    company_name: companyName,
    contact_name: contactName,
    email,
    phone,
    fleet_size: fleetSize,
    message,
  })

  if (error) {
    console.error('[submitEnterpriseLeadAction]', error)
    return { success: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  return { success: true }
}

export async function updateEnterpriseLeadStatusAction(
  leadId: string,
  status: EnterpriseLeadStatus,
): Promise<EnterpriseLeadResult> {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { error } = await admin.from('enterprise_leads').update({ status }).eq('id', leadId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/enterprise-leads')
  return { success: true }
}

export async function deleteEnterpriseLeadAction(leadId: string): Promise<EnterpriseLeadResult> {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { error } = await admin.from('enterprise_leads').delete().eq('id', leadId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/enterprise-leads')
  return { success: true }
}
