'use server'
// ── Partner Portals — Server Actions ────────────────────────────────────────────
// Incluido en el plan (Professional+), sin cobro aparte — no pasa por
// company_addons/Whop como los add-ons de IA. Ver lib/partners/engine.ts.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import {
  computePartnerCommission,
  PARTNER_RATE_ADJUSTMENT_MAX,
  PARTNER_RATE_ADJUSTMENT_MIN,
  type PartnerCommissionType,
} from '@/lib/partners/engine'
import { addIsoDays, zonedMidnightUtc } from '@/lib/time/zoned-bounds'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (á → a) tras la normalizacion NFD
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function createPartnerAction(formData: FormData): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name = (formData.get('name') as string)?.trim().slice(0, 120)
  if (!name) return { success: false, error: 'El nombre es obligatorio' }

  const rawSlug = (formData.get('slug') as string)?.trim() || name
  const slug = slugify(rawSlug)
  if (!slug) return { success: false, error: 'No se pudo generar un link válido con ese nombre' }

  const commissionType = ((formData.get('commission_type') as string) || 'percentage') as PartnerCommissionType
  if (commissionType !== 'percentage' && commissionType !== 'fixed') {
    return { success: false, error: 'Tipo de comisión inválido' }
  }
  const commissionValue = parseFloat((formData.get('commission_value') as string) || '0')
  const rateAdjustmentPct = Math.min(
    Math.max(parseFloat((formData.get('rate_adjustment_pct') as string) || '0'), PARTNER_RATE_ADJUSTMENT_MIN),
    PARTNER_RATE_ADJUSTMENT_MAX,
  )

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('partners')
    .insert({
      company_id: user.company_id,
      name,
      slug,
      logo_url: (formData.get('logo_url') as string)?.trim() || null,
      contact_name: (formData.get('contact_name') as string)?.trim() || null,
      contact_email: (formData.get('contact_email') as string)?.trim() || null,
      contact_phone: (formData.get('contact_phone') as string)?.trim() || null,
      rate_adjustment_pct: Number.isFinite(rateAdjustmentPct) ? rateAdjustmentPct : 0,
      commission_type: commissionType,
      commission_value: Number.isFinite(commissionValue) ? Math.max(commissionValue, 0) : 0,
    })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un partner con ese link — elige otro nombre o link' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/partners')
  return { success: true, data }
}

export async function updatePartnerAction(partnerId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name = (formData.get('name') as string)?.trim().slice(0, 120)
  if (!name) return { success: false, error: 'El nombre es obligatorio' }

  const commissionType = ((formData.get('commission_type') as string) || 'percentage') as PartnerCommissionType
  if (commissionType !== 'percentage' && commissionType !== 'fixed') {
    return { success: false, error: 'Tipo de comisión inválido' }
  }
  const commissionValue = parseFloat((formData.get('commission_value') as string) || '0')
  const rateAdjustmentPct = Math.min(
    Math.max(parseFloat((formData.get('rate_adjustment_pct') as string) || '0'), PARTNER_RATE_ADJUSTMENT_MIN),
    PARTNER_RATE_ADJUSTMENT_MAX,
  )

  const admin = createAdminClient()
  const { error } = await admin
    .from('partners')
    .update({
      name,
      logo_url: (formData.get('logo_url') as string)?.trim() || null,
      contact_name: (formData.get('contact_name') as string)?.trim() || null,
      contact_email: (formData.get('contact_email') as string)?.trim() || null,
      contact_phone: (formData.get('contact_phone') as string)?.trim() || null,
      rate_adjustment_pct: Number.isFinite(rateAdjustmentPct) ? rateAdjustmentPct : 0,
      commission_type: commissionType,
      commission_value: Number.isFinite(commissionValue) ? Math.max(commissionValue, 0) : 0,
    })
    .eq('id', partnerId)
    .eq('company_id', user.company_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/partners')
  return { success: true }
}

export async function togglePartnerActiveAction(partnerId: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('partners')
    .update({ is_active: isActive })
    .eq('id', partnerId)
    .eq('company_id', user.company_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/partners')
  return { success: true }
}

/**
 * Congela el periodo: guarda la comisión/reservas exactas de ESTE momento en
 * partner_payments, para que un cambio posterior de commission_value no
 * altere un periodo ya liquidado. No mueve dinero — el operador ya pagó al
 * partner por fuera de la plataforma.
 */
export async function markPartnerPeriodPaidAction(opts: {
  partnerId: string
  periodStart: string
  periodEnd: string
}): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const [{ data: partner }, { data: company }] = await Promise.all([
    admin
      .from('partners')
      .select('commission_type, commission_value')
      .eq('id', opts.partnerId)
      .eq('company_id', user.company_id)
      .single(),
    admin.from('companies').select('timezone').eq('id', user.company_id).single(),
  ])

  if (!partner) return { success: false, error: 'Partner no encontrado' }

  // Mismos límites en zona horaria de la EMPRESA que usa la página de detalle
  // del partner — si no coinciden, el monto que se congela aquí no es el que
  // el operador vio en pantalla antes de confirmar.
  const { data: trips } = await admin
    .from('bookings')
    .select('total_amount')
    .eq('company_id', user.company_id)
    .eq('partner_id', opts.partnerId)
    .eq('status', 'completed')
    .gte('completed_at', zonedMidnightUtc(opts.periodStart, company?.timezone).toISOString())
    .lt('completed_at', zonedMidnightUtc(addIsoDays(opts.periodEnd, 1), company?.timezone).toISOString())

  const tripRows = trips ?? []
  const totalAmount = tripRows.reduce(
    (sum, t) =>
      sum +
      computePartnerCommission(
        { commissionType: partner.commission_type as PartnerCommissionType, commissionValue: Number(partner.commission_value) },
        Number(t.total_amount ?? 0),
      ),
    0,
  )

  const { error } = await admin.from('partner_payments').insert({
    company_id: user.company_id,
    partner_id: opts.partnerId,
    period_start: opts.periodStart,
    period_end: opts.periodEnd,
    trips_count: tripRows.length,
    total_amount: Math.round(totalAmount * 100) / 100,
    marked_paid_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Este periodo ya fue marcado como pagado' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/partners')
  return { success: true }
}
