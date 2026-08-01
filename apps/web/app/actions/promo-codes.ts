'use server'
// ── Códigos promocionales — Server Actions ─────────────────────────────────────
// Add-on de pago ($3/mes Starter/Professional, incluido en Elite/Enterprise —
// ver lib/billing/addons.ts). CRUD para el operador + validación pública para
// el wizard de reserva (sin auth, mismo criterio que getPublicVehicleQuotesAction).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { isAddonActive } from '@/lib/billing/addons'
import { validatePromoCode, computeDiscount, type PromoDiscountType } from '@/lib/promo/engine'
import { addIsoDays, zonedMidnightUtc } from '@/lib/time/zoned-bounds'
import type { RewardTrigger } from '@/lib/supabase/database.types'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

async function requirePromoAddonActive(
  companyId: string,
): Promise<{ ok: true; timezone: string | null } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan, timezone').eq('id', companyId).single()
  if (!company) return { ok: false, error: 'Empresa no encontrada' }

  const { data: addon } = await admin
    .from('company_addons')
    .select('enabled')
    .eq('company_id', companyId)
    .eq('addon_key', 'promo_codes')
    .maybeSingle()

  if (!isAddonActive(company.plan, addon?.enabled ?? false)) {
    return { ok: false, error: 'El add-on de códigos promocionales no está activo para tu empresa' }
  }
  return { ok: true, timezone: company.timezone }
}

// ─── CRUD (operador) ───────────────────────────────────────────────────────────

export async function createPromoCodeAction(fd: FormData): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const gate = await requirePromoAddonActive(user.company_id)
  if (!gate.ok) return { success: false, error: gate.error }

  const code = (fd.get('code') as string)?.trim().toUpperCase().slice(0, 40)
  const discountType = fd.get('discount_type') as PromoDiscountType
  const discountValue = Number(fd.get('discount_value'))
  const maxUses = fd.get('max_uses') ? Number(fd.get('max_uses')) : null
  const maxUsesPerCustomer = fd.get('max_uses_per_customer') ? Number(fd.get('max_uses_per_customer')) : null
  const validFromDate = (fd.get('valid_from') as string) || null
  const validUntilDate = (fd.get('valid_until') as string) || null
  const minBookingAmount = fd.get('min_booking_amount') ? Number(fd.get('min_booking_amount')) : null

  if (!code) return { success: false, error: 'El código es obligatorio' }
  if (discountType !== 'percentage' && discountType !== 'fixed') return { success: false, error: 'Tipo de descuento inválido' }
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { success: false, error: 'Valor de descuento inválido' }
  if (discountType === 'percentage' && discountValue > 100) return { success: false, error: 'El porcentaje no puede superar 100%' }

  // `<input type="date">` solo manda 'YYYY-MM-DD' — sin esto, Postgres lo
  // interpreta como medianoche UTC en vez de medianoche de la zona horaria
  // de la empresa, y un código "vigente hasta el 15" expira 4h antes de lo
  // esperado en países al oeste de UTC (mismo bug que ya se corrigió en
  // lib/pricing/engine.ts para recargos). valid_until se guarda como el
  // inicio del día SIGUIENTE (límite exclusivo) para cubrir el día completo.
  const validFrom = validFromDate ? zonedMidnightUtc(validFromDate, gate.timezone).toISOString() : null
  const validUntil = validUntilDate ? zonedMidnightUtc(addIsoDays(validUntilDate, 1), gate.timezone).toISOString() : null

  const admin = createAdminClient()
  const { error } = await admin.from('promo_codes').insert({
    company_id: user.company_id,
    code,
    discount_type: discountType,
    discount_value: discountValue,
    max_uses: maxUses,
    max_uses_per_customer: maxUsesPerCustomer,
    valid_from: validFrom,
    valid_until: validUntil,
    min_booking_amount: minBookingAmount,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un código con ese nombre' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promo-codes')
  return { success: true }
}

export async function setPromoCodeActiveAction(promoCodeId: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('promo_codes')
    .update({ is_active: isActive })
    .eq('id', promoCodeId)
    .eq('company_id', user.company_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/promo-codes')
  return { success: true }
}

// ─── Validación pública (wizard de reserva) ────────────────────────────────────

export async function validatePromoCodeAction(opts: {
  slug: string
  code: string
  bookingAmount: number
  customerPhone: string
}): Promise<ActionResult<{ discountAmount: number; finalAmount: number }>> {
  const admin = createAdminClient()

  const { data: company } = await admin.from('companies').select('id, plan').eq('slug', opts.slug).single()
  if (!company) return { success: false, error: 'Empresa no encontrada' }

  const { data: addon } = await admin
    .from('company_addons')
    .select('enabled')
    .eq('company_id', company.id)
    .eq('addon_key', 'promo_codes')
    .maybeSingle()
  if (!isAddonActive(company.plan, addon?.enabled ?? false)) {
    return { success: false, error: 'Este operador no tiene códigos promocionales activados' }
  }

  const code = opts.code.trim().toUpperCase()
  const { data: promo } = await admin
    .from('promo_codes')
    .select('*')
    .eq('company_id', company.id)
    .eq('code', code)
    .maybeSingle()
  if (!promo) return { success: false, error: 'Código no válido' }

  const { count: customerRedemptionsCount } = await admin
    .from('promo_code_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('promo_code_id', promo.id)
    .eq('customer_phone', opts.customerPhone)

  const result = validatePromoCode(
    {
      discountType: promo.discount_type as 'percentage' | 'fixed',
      discountValue: Number(promo.discount_value),
      maxUses: promo.max_uses,
      usesCount: promo.uses_count,
      maxUsesPerCustomer: promo.max_uses_per_customer,
      validFrom: promo.valid_from,
      validUntil: promo.valid_until,
      minBookingAmount: promo.min_booking_amount,
      isActive: promo.is_active,
    },
    { bookingAmount: opts.bookingAmount, customerRedemptionsCount: customerRedemptionsCount ?? 0 },
  )

  const ERROR_MESSAGES: Record<string, string> = {
    inactive: 'Este código ya no está activo',
    not_yet_valid: 'Este código todavía no está vigente',
    expired: 'Este código expiró',
    max_uses_reached: 'Este código alcanzó su límite de usos',
    customer_limit_reached: 'Ya usaste este código el máximo de veces permitido',
    below_minimum: 'El monto de tu reserva no alcanza el mínimo requerido para este código',
  }

  if (!result.valid) {
    return { success: false, error: ERROR_MESSAGES[result.error!] ?? 'Código no válido' }
  }

  const discountAmount = computeDiscount(
    { discountType: promo.discount_type as 'percentage' | 'fixed', discountValue: Number(promo.discount_value) },
    opts.bookingAmount,
  )

  return { success: true, data: { discountAmount, finalAmount: opts.bookingAmount - discountAmount } }
}

// ─── Reglas de recompensa automática ──────────────────────────────────────────
// Los códigos de arriba son manuales: el operador los crea y los reparte. Esto
// los automatiza — cuando un cliente cumple una condición, el sistema le
// genera un código personal (ver lib/rewards/grant.ts).
//
// Va detrás del MISMO add-on que los códigos manuales: es la misma capacidad,
// solo que disparada sola.

const REWARD_TRIGGERS: RewardTrigger[] = [
  'trips_completed', 'total_spent', 'first_trip', 'inactivity_days', 'review_submitted', 'birthday',
]
// Disparadores que NO llevan umbral. Debe coincidir con el CHECK de la
// migración 79 (reward_rules_threshold_required), o el insert lo rechaza la
// base.
const TRIGGERS_WITHOUT_THRESHOLD: RewardTrigger[] = ['first_trip', 'review_submitted', 'birthday']

export async function createRewardRuleAction(fd: FormData): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const gate = await requirePromoAddonActive(user.company_id)
  if (!gate.ok) return { success: false, error: gate.error }

  const name = (fd.get('name') as string ?? '').trim().slice(0, 120)
  if (!name) return { success: false, error: 'Ponle un nombre a la regla' }

  const triggerType = fd.get('trigger_type') as RewardTrigger
  if (!REWARD_TRIGGERS.includes(triggerType)) {
    return { success: false, error: 'Disparador inválido' }
  }

  const needsThreshold = !TRIGGERS_WITHOUT_THRESHOLD.includes(triggerType)
  const rawThreshold = parseFloat(fd.get('threshold') as string)
  if (needsThreshold && (!Number.isFinite(rawThreshold) || rawThreshold <= 0)) {
    return { success: false, error: 'Este disparador necesita un valor mayor que cero' }
  }

  const discountType = fd.get('discount_type') as 'percentage' | 'fixed'
  if (discountType !== 'percentage' && discountType !== 'fixed') {
    return { success: false, error: 'Tipo de descuento inválido' }
  }

  const discountValue = parseFloat(fd.get('discount_value') as string)
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return { success: false, error: 'El descuento debe ser mayor que cero' }
  }
  if (discountType === 'percentage' && discountValue > 100) {
    return { success: false, error: 'Un descuento porcentual no puede pasar de 100%' }
  }

  const validDaysRaw = parseInt(fd.get('valid_days') as string ?? '90', 10)
  const validDays = Number.isFinite(validDaysRaw) && validDaysRaw > 0 ? Math.min(validDaysRaw, 730) : 90

  const admin = createAdminClient()
  const { error } = await admin.from('reward_rules').insert({
    company_id: user.company_id,
    name,
    trigger_type: triggerType,
    threshold: needsThreshold ? rawThreshold : null,
    discount_type: discountType,
    discount_value: discountValue,
    valid_days: validDays,
  })

  if (error) {
    console.error('[createRewardRuleAction]', error)
    return { success: false, error: 'No se pudo crear la regla' }
  }

  revalidatePath('/admin/promo-codes')
  return { success: true }
}

export async function setRewardRuleActiveAction(ruleId: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('reward_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[setRewardRuleActiveAction]', error)
    return { success: false, error: 'No se pudo actualizar' }
  }

  revalidatePath('/admin/promo-codes')
  return { success: true }
}

export async function deleteRewardRuleAction(ruleId: string): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  // Los reward_grants tienen ON DELETE CASCADE: al borrar la regla se pierde
  // el registro de quién ya la recibió. Los códigos ya emitidos siguen vivos
  // (promo_codes es tabla aparte), que es lo correcto: el cliente ya lo tiene.
  const { error } = await admin
    .from('reward_rules')
    .delete()
    .eq('id', ruleId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[deleteRewardRuleAction]', error)
    return { success: false, error: 'No se pudo eliminar' }
  }

  revalidatePath('/admin/promo-codes')
  return { success: true }
}
