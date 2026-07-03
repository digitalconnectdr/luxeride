'use server'
// ── Reportes de conductor (trip_reports) — gestión desde el admin ──────────────
// La tabla ya existía (reportDriverAction en app/actions/trip.ts la llena desde
// /track/[id]) pero no había ninguna pantalla para revisarlos ni marcarlos como
// resueltos — resolved_at/resolved_by existían sin usarse.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

export async function resolveTripReportAction(reportId: string): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('trip_reports')
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', reportId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[resolveTripReportAction]', error)
    return { success: false, error: 'Error al marcar el reporte como resuelto' }
  }

  revalidatePath('/admin/driver-reports')
  return { success: true }
}
