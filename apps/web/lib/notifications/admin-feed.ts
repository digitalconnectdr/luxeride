// ── Centro de notificaciones del panel admin (admin_notifications) ────────────
// Distinto de lib/notifications/index.ts (email/SMS): esto alimenta la
// campana visual del panel admin, no envía nada al pasajero/conductor.
// pushAdminNotification() nunca lanza — un fallo aquí no debe tumbar la
// acción principal (crear un reporte, correr el cron diario, etc.).

import { createAdminClient } from '@/lib/supabase/server'

export interface PushAdminNotificationParams {
  companyId: string
  type: string
  title: string
  detail?: string
  href?: string
  /** Fuente para deduplicar (ej. 'vehicles' + el id del vehículo). */
  sourceTable?: string
  sourceId?: string
  /**
   * Si se pasa junto con sourceId, no inserta si ya existe un aviso del mismo
   * type+sourceId creado dentro de esta ventana — evita que el cron diario
   * repita el mismo aviso (ej. un vehículo con seguro por vencer) todos los
   * días mientras la condición siga vigente.
   */
  dedupDays?: number
}

export async function pushAdminNotification(params: PushAdminNotificationParams): Promise<void> {
  try {
    const admin = createAdminClient()

    if (params.dedupDays && params.sourceId) {
      const since = new Date(Date.now() - params.dedupDays * 86_400_000).toISOString()
      const { data: existing } = await admin
        .from('admin_notifications')
        .select('id')
        .eq('company_id', params.companyId)
        .eq('type', params.type)
        .eq('source_id', params.sourceId)
        .gte('created_at', since)
        .limit(1)
      if (existing && existing.length > 0) return
    }

    await admin.from('admin_notifications').insert({
      company_id: params.companyId,
      type: params.type,
      title: params.title,
      detail: params.detail ?? null,
      href: params.href ?? null,
      source_table: params.sourceTable ?? null,
      source_id: params.sourceId ?? null,
    })
  } catch (err) {
    console.error('[pushAdminNotification]', err)
  }
}

/** Purga avisos viejos — la campana solo muestra 7 días, no hace falta guardar más de 30. */
export async function cleanupOldAdminNotifications(): Promise<void> {
  try {
    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
    await admin.from('admin_notifications').delete().lt('created_at', cutoff)
  } catch (err) {
    console.error('[cleanupOldAdminNotifications]', err)
  }
}
