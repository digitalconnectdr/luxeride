'use server'

// ── Botón "Verificar ahora" del panel /super-admin/system — corre los
// mismos chequeos que el cron, pero SIN disparar alertas (evita que un
// super-admin curioseando el botón spamee su propio email/SMS). Las alertas
// solo las dispara el cron protegido en /api/cron/system-health.

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { runAllHealthChecks } from '@/lib/monitoring/health'
import type { Json } from '@/lib/supabase/database.types'

export async function runSystemHealthCheckAction(): Promise<{ success: boolean; error?: string }> {
  await requireRole('super_admin')

  try {
    const admin = createAdminClient()
    const results = await runAllHealthChecks()

    const { error } = await admin.from('system_health_checks').upsert(
      results.map((r) => ({
        service: r.service,
        status: r.status,
        message: r.message ?? null,
        response_ms: r.responseMs ?? null,
        meta: (r.meta as Json | undefined) ?? null,
        checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'service' },
    )
    if (error) return { success: false, error: error.message }

    revalidatePath('/super-admin/system')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al verificar' }
  }
}
