'use server'
// ── Interruptor Automático/Manual de auto-asignación (Dispatch Board) ─────────

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

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
