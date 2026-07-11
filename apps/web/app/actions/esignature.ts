'use server'
// ── Firma electrónica — Server Actions ─────────────────────────────────────────
// Add-on de pago ($9/mes Starter/Professional, incluido en Elite/Enterprise —
// ver lib/billing/addons.ts). Alcance: acuerdo del conductor al unirse +
// contrato de cuenta corporativa (ver lib/esignature/templates.ts).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { isAddonActive } from '@/lib/billing/addons'
import {
  DRIVER_AGREEMENT_TEXT,
  DRIVER_AGREEMENT_VERSION,
  CORPORATE_AGREEMENT_TEXT,
  CORPORATE_AGREEMENT_VERSION,
} from '@/lib/esignature/templates'

type ActionResult = { success: boolean; error?: string }

async function requireEsignatureAddonActive(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan').eq('id', companyId).single()
  if (!company) return { ok: false, error: 'Empresa no encontrada' }

  const { data: addon } = await admin
    .from('company_addons')
    .select('enabled')
    .eq('company_id', companyId)
    .eq('addon_key', 'esignature')
    .maybeSingle()

  if (!isAddonActive(company.plan, addon?.enabled ?? false)) {
    return { ok: false, error: 'El add-on de firma electrónica no está activo para tu empresa' }
  }
  return { ok: true }
}

/** Decodifica un data URL "data:image/png;base64,..." y lo sube al bucket "documents". */
async function uploadSignatureImage(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  subjectType: 'driver' | 'corporate_account',
  subjectId: string,
  signatureDataUrl: string,
): Promise<{ path?: string; error?: string }> {
  const match = /^data:image\/png;base64,(.+)$/.exec(signatureDataUrl)
  if (!match) return { error: 'Firma inválida' }

  const buffer = Buffer.from(match[1], 'base64')
  if (buffer.length > 500_000) return { error: 'La firma es demasiado grande' }

  const path = `${companyId}/agreements/${subjectType}/${subjectId}-${Date.now()}.png`
  const { error } = await admin.storage.from('documents').upload(path, buffer, { contentType: 'image/png' })
  if (error) {
    console.error('[uploadSignatureImage]', error)
    return { error: 'Error al subir la firma' }
  }
  return { path }
}

export async function signDriverAgreementAction(
  driverId: string,
  signedByName: string,
  signatureDataUrl: string,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const gate = await requireEsignatureAddonActive(user.company_id)
  if (!gate.ok) return { success: false, error: gate.error }

  if (!signedByName.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const admin = createAdminClient()
  const upload = await uploadSignatureImage(admin, user.company_id, 'driver', driverId, signatureDataUrl)
  if (upload.error || !upload.path) return { success: false, error: upload.error ?? 'Error al subir la firma' }

  const { error } = await admin.from('signed_agreements').insert({
    company_id: user.company_id,
    subject_type: 'driver',
    subject_id: driverId,
    document_version: DRIVER_AGREEMENT_VERSION,
    agreement_text_snapshot: DRIVER_AGREEMENT_TEXT,
    signature_image_path: upload.path,
    signed_by_name: signedByName.trim(),
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/esignature')
  return { success: true }
}

export async function signCorporateAgreementAction(
  corporateAccountId: string,
  signedByName: string,
  signatureDataUrl: string,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const gate = await requireEsignatureAddonActive(user.company_id)
  if (!gate.ok) return { success: false, error: gate.error }

  if (!signedByName.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const admin = createAdminClient()
  const upload = await uploadSignatureImage(admin, user.company_id, 'corporate_account', corporateAccountId, signatureDataUrl)
  if (upload.error || !upload.path) return { success: false, error: upload.error ?? 'Error al subir la firma' }

  const { error } = await admin.from('signed_agreements').insert({
    company_id: user.company_id,
    subject_type: 'corporate_account',
    subject_id: corporateAccountId,
    document_version: CORPORATE_AGREEMENT_VERSION,
    agreement_text_snapshot: CORPORATE_AGREEMENT_TEXT,
    signature_image_path: upload.path,
    signed_by_name: signedByName.trim(),
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/esignature')
  return { success: true }
}
