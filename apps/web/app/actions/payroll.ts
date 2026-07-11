'use server'
// ── Nómina de conductores — Server Actions ─────────────────────────────────────
// Add-on de pago ($9/mes Starter/Professional, incluido en Elite/Enterprise —
// ver lib/billing/addons.ts). Alcance: solo cálculo y reporte, nunca mueve
// dinero real. Ver lib/payroll/engine.ts.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { isAddonActive } from '@/lib/billing/addons'
import { computeDriverEarnings, type PayrollType } from '@/lib/payroll/engine'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

async function requirePayrollAddonActive(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan').eq('id', companyId).single()
  if (!company) return { ok: false, error: 'Empresa no encontrada' }

  const { data: addon } = await admin
    .from('company_addons')
    .select('enabled')
    .eq('company_id', companyId)
    .eq('addon_key', 'driver_payroll')
    .maybeSingle()

  if (!isAddonActive(company.plan, addon?.enabled ?? false)) {
    return { ok: false, error: 'El add-on de nómina de conductores no está activo para tu empresa' }
  }
  return { ok: true }
}

export async function updateDriverPayrollSettingsAction(
  driverId: string,
  payrollType: PayrollType,
  payrollRate: number,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const gate = await requirePayrollAddonActive(user.company_id)
  if (!gate.ok) return { success: false, error: gate.error }

  if (payrollType !== 'commission' && payrollType !== 'flat_per_trip') {
    return { success: false, error: 'Modelo de pago inválido' }
  }
  if (!Number.isFinite(payrollRate) || payrollRate <= 0) return { success: false, error: 'Tarifa inválida' }
  if (payrollType === 'commission' && payrollRate > 100) return { success: false, error: 'La comisión no puede superar 100%' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('drivers')
    .update({ payroll_type: payrollType, payroll_rate: payrollRate })
    .eq('id', driverId)
    .eq('company_id', user.company_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/payroll')
  return { success: true }
}

/**
 * Congela el periodo: guarda el monto/viajes exactos de ESTE momento en
 * payroll_payments, para que un cambio posterior de payroll_rate no altere un
 * periodo ya liquidado. No mueve dinero — el operador ya pagó por fuera.
 */
export async function markPayrollPeriodPaidAction(opts: {
  driverId: string
  periodStart: string
  periodEnd: string
}): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const gate = await requirePayrollAddonActive(user.company_id)
  if (!gate.ok) return { success: false, error: gate.error }

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers')
    .select('payroll_type, payroll_rate')
    .eq('id', opts.driverId)
    .eq('company_id', user.company_id)
    .single()

  if (!driver?.payroll_type || !driver.payroll_rate) {
    return { success: false, error: 'Este conductor no tiene un modelo de pago configurado' }
  }

  const { data: trips } = await admin
    .from('bookings')
    .select('total_amount')
    .eq('company_id', user.company_id)
    .eq('driver_id', opts.driverId)
    .eq('status', 'completed')
    .gte('completed_at', opts.periodStart)
    .lte('completed_at', opts.periodEnd)

  const tripRows = (trips ?? []).map((t) => ({ totalAmount: Number(t.total_amount ?? 0) }))
  const totalAmount = computeDriverEarnings(tripRows, driver.payroll_type as PayrollType, Number(driver.payroll_rate))

  const { error } = await admin.from('payroll_payments').insert({
    company_id: user.company_id,
    driver_id: opts.driverId,
    period_start: opts.periodStart,
    period_end: opts.periodEnd,
    trips_count: tripRows.length,
    total_amount: totalAmount,
    marked_paid_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Este periodo ya fue marcado como pagado' }
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/payroll')
  return { success: true }
}
