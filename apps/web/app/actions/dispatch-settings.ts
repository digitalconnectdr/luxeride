'use server'
// ── Interruptor Automático/Manual de auto-asignación (Dispatch Board) ─────────

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { parseDispatchWeights, type DispatchWeights } from '@/lib/dispatch/scoring'
import type { Json } from '@/lib/supabase/database.types'

export async function updateAutoAssignSettingAction(
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .update({ auto_assign_enabled: enabled })
    .eq('id', user.company_id)

  if (error) {
    console.error('[updateAutoAssignSettingAction]', error)
    return { success: false, error: 'No se pudo actualizar' }
  }

  revalidatePath('/dispatcher/dashboard')
  return { success: true }
}

/**
 * Pesos del score de auto-asignación (ver lib/dispatch/scoring.ts). Se guardan
 * dentro de `companies.settings` para no pedir una migración por cuatro
 * números; el resto de settings se preserva con un merge explícito, porque un
 * UPDATE de la columna JSONB completa borraría la política de cancelación, los
 * recordatorios y todo lo demás que vive ahí.
 */
export async function updateDispatchWeightsAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; weights?: DispatchWeights }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const weights = parseDispatchWeights({
    proximity: formData.get('proximity'),
    fairness: formData.get('fairness'),
    rating: formData.get('rating'),
    reliability: formData.get('reliability'),
  })

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('companies')
    .select('settings')
    .eq('id', user.company_id)
    .single()

  const settings = {
    ...((current?.settings as Record<string, unknown>) ?? {}),
    // Se escribe como objeto plano: DispatchWeights es una interfaz sin índice
    // de string y el tipo Json de Supabase no la acepta directo.
    dispatch_weights: { ...weights },
  }

  const { error } = await admin
    .from('companies')
    .update({ settings: settings as Json })
    .eq('id', user.company_id)

  if (error) {
    console.error('[updateDispatchWeightsAction]', error)
    return { success: false, error: 'No se pudieron guardar los pesos' }
  }

  revalidatePath('/dispatcher/dashboard')
  revalidatePath('/admin/settings')
  return { success: true, weights }
}
