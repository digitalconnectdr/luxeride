'use server'
// ── F1.6 — Pricing Engine: Server Actions ─────────────────────────────────────
// SECURITY: Prices ALWAYS calculated server-side — frontend never sends amounts.
// OWASP compliant — company_id enforced from server session on every mutation.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { PricingModel } from '@/lib/supabase/database.types'

const VALID_MODELS: PricingModel[] = ['flat_rate', 'per_mile', 'per_km', 'hourly', 'zone_based']

function parseDecimal(val: FormDataEntryValue | null, fallback = 0): number {
  const n = parseFloat(val as string)
  return isNaN(n) ? fallback : n
}

/** `<input type="date">` vacío llega como '' — la columna quiere NULL. */
function parseDate(val: FormDataEntryValue | null): string | null {
  const s = (val as string ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/**
 * Días de la semana marcados (checkboxes `days_of_week` con valor 0..6).
 * Si están todos marcados (o ninguno) se guarda NULL: "aplica siempre" es más
 * claro en la base que un arreglo con los 7 días, y el motor lo trata igual.
 */
function parseDaysOfWeek(formData: FormData): number[] | null {
  const days = formData
    .getAll('days_of_week')
    .map((v) => parseInt(v as string, 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  const unique = Array.from(new Set(days)).sort()
  if (unique.length === 0 || unique.length === 7) return null
  return unique
}

/**
 * El multiplicador de demanda solo tiene sentido > 1 (cobrar MÁS). Un valor
 * por debajo de 1 sería un descuento disfrazado y para eso están los códigos
 * promocionales; se topa a 5x para que un cero de más en el formulario no
 * multiplique una tarifa por 50.
 */
function parseSurgeMultiplier(val: FormDataEntryValue | null): number {
  const n = parseDecimal(val, 1)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, 5)
}

export async function createPricingRuleAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name  = (formData.get('name') as string ?? '').trim()
  const model = formData.get('model') as PricingModel

  if (!name)                          return { success: false, error: 'Nombre requerido' }
  if (!VALID_MODELS.includes(model))  return { success: false, error: 'Modelo de pricing inválido' }

  const vehicleTypeId  = (formData.get('vehicle_type_id') as string ?? '').trim() || null
  const originZoneId   = (formData.get('origin_zone_id') as string ?? '').trim() || null
  const destZoneId     = (formData.get('destination_zone_id') as string ?? '').trim() || null

  const admin = createAdminClient()
  const { error } = await admin.from('pricing_rules').insert({
    company_id:            user.company_id,
    name,
    model,
    vehicle_type_id:        vehicleTypeId,
    base_price:             parseDecimal(formData.get('base_price')),
    per_mile_rate:          parseDecimal(formData.get('per_mile_rate')),
    per_km_rate:            parseDecimal(formData.get('per_km_rate')),
    hourly_rate:            parseDecimal(formData.get('hourly_rate')),
    minimum_fare:           parseDecimal(formData.get('minimum_fare')),
    minimum_hours:          parseDecimal(formData.get('minimum_hours')),
    origin_zone_id:         originZoneId,
    destination_zone_id:    destZoneId,
    airport_pickup_fee:     parseDecimal(formData.get('airport_pickup_fee')),
    airport_dropoff_fee:    parseDecimal(formData.get('airport_dropoff_fee')),
    night_surcharge_pct:    parseDecimal(formData.get('night_surcharge_pct')),
    weekend_surcharge_pct:  parseDecimal(formData.get('weekend_surcharge_pct')),
    holiday_surcharge_pct:  parseDecimal(formData.get('holiday_surcharge_pct')),
    surge_enabled:          formData.get('surge_enabled') === 'true',
    surge_multiplier:       parseSurgeMultiplier(formData.get('surge_multiplier')),
    valid_from:             parseDate(formData.get('valid_from')),
    valid_until:            parseDate(formData.get('valid_until')),
    days_of_week:           parseDaysOfWeek(formData),
    priority:               parseInt(formData.get('priority') as string ?? '0', 10) || 0,
    is_active:              true,
  })

  if (error) {
    console.error('[createPricingRuleAction]', error)
    return { success: false, error: 'Error al crear la regla de precio' }
  }

  revalidatePath('/admin/pricing')
  return { success: true }
}

export async function updatePricingRuleAction(
  ruleId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name  = (formData.get('name') as string ?? '').trim()
  const model = formData.get('model') as PricingModel

  if (!name)                          return { success: false, error: 'Nombre requerido' }
  if (!VALID_MODELS.includes(model))  return { success: false, error: 'Modelo de pricing inválido' }

  const vehicleTypeId  = (formData.get('vehicle_type_id') as string ?? '').trim() || null
  const originZoneId   = (formData.get('origin_zone_id') as string ?? '').trim() || null
  const destZoneId     = (formData.get('destination_zone_id') as string ?? '').trim() || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('pricing_rules')
    .update({
      name,
      model,
      vehicle_type_id:        vehicleTypeId,
      base_price:             parseDecimal(formData.get('base_price')),
      per_mile_rate:          parseDecimal(formData.get('per_mile_rate')),
      per_km_rate:            parseDecimal(formData.get('per_km_rate')),
      hourly_rate:            parseDecimal(formData.get('hourly_rate')),
      minimum_fare:           parseDecimal(formData.get('minimum_fare')),
      minimum_hours:          parseDecimal(formData.get('minimum_hours')),
      origin_zone_id:         originZoneId,
      destination_zone_id:    destZoneId,
      airport_pickup_fee:     parseDecimal(formData.get('airport_pickup_fee')),
      airport_dropoff_fee:    parseDecimal(formData.get('airport_dropoff_fee')),
      night_surcharge_pct:    parseDecimal(formData.get('night_surcharge_pct')),
      weekend_surcharge_pct:  parseDecimal(formData.get('weekend_surcharge_pct')),
      holiday_surcharge_pct:  parseDecimal(formData.get('holiday_surcharge_pct')),
      surge_enabled:          formData.get('surge_enabled') === 'true',
      surge_multiplier:       parseSurgeMultiplier(formData.get('surge_multiplier')),
      valid_from:             parseDate(formData.get('valid_from')),
      valid_until:            parseDate(formData.get('valid_until')),
      days_of_week:           parseDaysOfWeek(formData),
      priority:               parseInt(formData.get('priority') as string ?? '0', 10) || 0,
    })
    .eq('id', ruleId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[updatePricingRuleAction]', error)
    return { success: false, error: 'Error al actualizar la regla' }
  }

  revalidatePath('/admin/pricing')
  return { success: true }
}

export async function togglePricingRuleActiveAction(
  ruleId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('pricing_rules')
    .update({ is_active: isActive })
    .eq('id', ruleId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[togglePricingRuleActiveAction]', error)
    return { success: false, error: 'Error al actualizar estado' }
  }

  revalidatePath('/admin/pricing')
  return { success: true }
}

export async function deletePricingRuleAction(
  ruleId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('pricing_rules')
    .delete()
    .eq('id', ruleId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[deletePricingRuleAction]', error)
    return { success: false, error: 'Error al eliminar la regla' }
  }

  revalidatePath('/admin/pricing')
  return { success: true }
}
