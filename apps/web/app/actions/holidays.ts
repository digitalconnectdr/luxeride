'use server'
// ── Feriados por empresa (recargo de tarifa) ──────────────────────────────────
// `pricing_rules.holiday_surcharge_pct` no puede aplicarse sin saber qué día es
// feriado. Estas acciones alimentan `company_holidays` (migración 77), que es
// lo que consulta lib/pricing/holidays.ts en cada cotización.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function addCompanyHolidayAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const date = (formData.get('holiday_date') as string ?? '').trim()
  const name = (formData.get('name') as string ?? '').trim().slice(0, 120)

  if (!DATE_RE.test(date)) return { success: false, error: 'Fecha inválida' }
  if (!name)               return { success: false, error: 'Ponle un nombre al feriado' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_holidays').insert({
    company_id: user.company_id,
    holiday_date: date,
    name,
  })

  if (error) {
    // 23505 = unique_violation. La empresa ya declaró ese día; no es un fallo
    // que valga la pena mostrar como error rojo.
    if (error.code === '23505') return { success: false, error: 'Ese día ya está declarado como feriado' }
    console.error('[addCompanyHolidayAction]', error)
    return { success: false, error: 'No se pudo guardar el feriado' }
  }

  revalidatePath('/admin/pricing')
  return { success: true }
}

export async function deleteCompanyHolidayAction(
  holidayId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
  if (!UUID_RE.test(holidayId)) return { success: false, error: 'Feriado inválido' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_holidays')
    .delete()
    .eq('id', holidayId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[deleteCompanyHolidayAction]', error)
    return { success: false, error: 'No se pudo eliminar el feriado' }
  }

  revalidatePath('/admin/pricing')
  return { success: true }
}
