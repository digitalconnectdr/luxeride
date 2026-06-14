'use server'
// ── F1.7 — Company Settings: Server Actions ───────────────────────────────────
// SECURITY: Solo company_owner puede modificar settings.
// OWASP compliant — company_id del servidor, nunca del cliente.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

export async function updateCompanyInfoAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name     = (formData.get('name') as string ?? '').trim()
  const phone    = (formData.get('phone') as string ?? '').trim() || null
  const email    = (formData.get('email') as string ?? '').trim() || null
  const address  = (formData.get('address') as string ?? '').trim() || null
  const city     = (formData.get('city') as string ?? '').trim() || null
  const country  = (formData.get('country') as string ?? '').trim() || null
  const timezone = (formData.get('timezone') as string ?? '').trim() || null
  const currency = (formData.get('currency') as string ?? '').trim() || null

  if (!name) return { success: false, error: 'Nombre de empresa requerido' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .update({
      name,
      phone:    phone ?? undefined,
      email:    email ?? undefined,
      address:  address ?? undefined,
      city:     city ?? undefined,
      country:  country ?? undefined,
      timezone: timezone ?? undefined,
      currency: currency ?? undefined,
    })
    .eq('id', user.company_id)

  if (error) {
    console.error('[updateCompanyInfoAction]', error)
    return { success: false, error: 'Error al actualizar la información' }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

export async function updateBookingSettingsAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const advanceHours       = parseInt(formData.get('advance_booking_hours') as string ?? '2', 10) || 2
  const maxAdvanceDays     = parseInt(formData.get('max_advance_days') as string ?? '90', 10) || 90
  const allowInstant       = formData.get('allow_instant_booking') === 'true'
  const requireDeposit     = formData.get('require_deposit') === 'true'
  const depositPercentage  = parseFloat(formData.get('deposit_percentage') as string ?? '0') || 0

  const admin = createAdminClient()

  // Fetch current settings to merge (JSONB merge)
  const { data: company } = await admin
    .from('companies')
    .select('settings')
    .eq('id', user.company_id)
    .single()

  if (!company) return { success: false, error: 'Empresa no encontrada' }

  const currentSettings = (company.settings as Record<string, unknown>) ?? {}
  const updatedSettings = {
    ...currentSettings,
    booking: {
      advance_booking_hours: advanceHours,
      max_advance_days:      maxAdvanceDays,
      allow_instant_booking: allowInstant,
      require_deposit:       requireDeposit,
      deposit_percentage:    depositPercentage,
    },
  }

  const { error } = await admin
    .from('companies')
    .update({ settings: updatedSettings })
    .eq('id', user.company_id)

  if (error) {
    console.error('[updateBookingSettingsAction]', error)
    return { success: false, error: 'Error al actualizar configuración de reservaciones' }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

// ── F1.10 — Policy Engine: políticas de cancelación ───────────────────────────

export async function updatePolicySettingsAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const clampPct = (v: number) => Math.min(100, Math.max(0, v))
  const clampHrs = (v: number) => Math.max(0, v)

  const freeCancellationHours   = clampHrs(parseFloat(formData.get('free_cancellation_hours') as string ?? '24') || 24)
  const lateCancellationFeePct  = clampPct(parseFloat(formData.get('late_cancellation_fee_pct') as string ?? '50') || 0)
  const noShowFeePct            = clampPct(parseFloat(formData.get('no_show_fee_pct') as string ?? '100') || 0)
  const modificationMinHours    = clampHrs(parseFloat(formData.get('modification_min_hours') as string ?? '4') || 4)

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('settings')
    .eq('id', user.company_id)
    .single()

  if (!company) return { success: false, error: 'Empresa no encontrada' }

  const currentSettings = (company.settings as Record<string, unknown>) ?? {}
  const updatedSettings = {
    ...currentSettings,
    policy: {
      free_cancellation_hours:   freeCancellationHours,
      late_cancellation_fee_pct: lateCancellationFeePct,
      no_show_fee_pct:           noShowFeePct,
      modification_min_hours:    modificationMinHours,
    },
  }

  const { error } = await admin
    .from('companies')
    .update({ settings: updatedSettings })
    .eq('id', user.company_id)

  if (error) {
    console.error('[updatePolicySettingsAction]', error)
    return { success: false, error: 'Error al actualizar políticas' }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

// ── White-label: logo + color de marca de la empresa ─────────────────────────

export type BrandingResult = { success: boolean; error?: string; logoUrl?: string | null }

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

export async function updateBrandingAction(
  _prev: BrandingResult | null,
  formData: FormData,
): Promise<BrandingResult> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const primaryColor = (formData.get('primary_color') as string ?? '').trim()
  const logo = formData.get('logo') as File | null
  const removeLogo = formData.get('remove_logo') === 'true'

  const admin = createAdminClient()
  const updates: { primary_color?: string; logo_url?: string | null } = {}

  if (/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    updates.primary_color = primaryColor
  }

  if (removeLogo) {
    updates.logo_url = null
  } else if (logo && logo.size > 0) {
    if (logo.size > 2_000_000) {
      return { success: false, error: 'El logo no puede superar 2 MB.' }
    }
    const ext = MIME_EXT[logo.type]
    if (!ext) {
      return { success: false, error: 'Formato no válido. Usa PNG, JPG, SVG o WebP.' }
    }
    const path = `${user.company_id}/logo.${ext}`
    const buffer = Buffer.from(await logo.arrayBuffer())
    const { error: upErr } = await admin.storage
      .from('branding')
      .upload(path, buffer, { contentType: logo.type, upsert: true })
    if (upErr) {
      console.error('[updateBrandingAction] upload', upErr)
      return { success: false, error: 'Error al subir el logo.' }
    }
    const { data: pub } = admin.storage.from('branding').getPublicUrl(path)
    // cache-bust para que el navegador tome la versión nueva
    updates.logo_url = `${pub.publicUrl}?v=${Date.now()}`
  }

  if (Object.keys(updates).length === 0) {
    return { success: true }
  }

  const { error } = await admin
    .from('companies')
    .update(updates)
    .eq('id', user.company_id)

  if (error) {
    console.error('[updateBrandingAction]', error)
    return { success: false, error: 'Error al guardar la marca.' }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/book', 'layout')
  return { success: true, logoUrl: updates.logo_url }
}

export async function updateGratuitySettingsAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const enabled           = formData.get('enabled') === 'true'
  const defaultPercentage = parseFloat(formData.get('default_percentage') as string ?? '20') || 20

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('settings')
    .eq('id', user.company_id)
    .single()

  if (!company) return { success: false, error: 'Empresa no encontrada' }

  const currentSettings = (company.settings as Record<string, unknown>) ?? {}
  const updatedSettings = {
    ...currentSettings,
    gratuity: {
      enabled,
      default_percentage: defaultPercentage,
      options: [15, 18, 20, 25],
    },
  }

  const { error } = await admin
    .from('companies')
    .update({ settings: updatedSettings })
    .eq('id', user.company_id)

  if (error) {
    console.error('[updateGratuitySettingsAction]', error)
    return { success: false, error: 'Error al actualizar configuración de gratuity' }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}
