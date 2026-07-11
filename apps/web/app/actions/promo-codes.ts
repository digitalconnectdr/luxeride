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

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

async function requirePromoAddonActive(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan').eq('id', companyId).single()
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
  return { ok: true }
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
  const validFrom = (fd.get('valid_from') as string) || null
  const validUntil = (fd.get('valid_until') as string) || null
  const minBookingAmount = fd.get('min_booking_amount') ? Number(fd.get('min_booking_amount')) : null

  if (!code) return { success: false, error: 'El código es obligatorio' }
  if (discountType !== 'percentage' && discountType !== 'fixed') return { success: false, error: 'Tipo de descuento inválido' }
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { success: false, error: 'Valor de descuento inválido' }
  if (discountType === 'percentage' && discountValue > 100) return { success: false, error: 'El porcentaje no puede superar 100%' }

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
