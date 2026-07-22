'use server'
// ── Estado de lectura de la campana de notificaciones del super-admin ─────────
// No marca nada como "leído" a nivel de negocio (una solicitud sigue
// 'submitted' hasta que se triage de verdad en /super-admin/feature-requests)
// -- esto es puramente "¿ya abrí la campana después de que aparecieron estos
// avisos?", para que el punto rojo no reaparezca como si fuera nuevo.

import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

export async function markSuperAdminNotificationsSeenAction(): Promise<void> {
  const user = await requireRole('super_admin')
  const admin = createAdminClient()
  await admin
    .from('super_admin_notification_reads')
    .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() })
}

// ── Estado de lectura de la campana del panel admin (misma idea, scoped a
// admin_notifications en vez de las 3 fuentes del super-admin) ────────────────
export async function markAdminNotificationsSeenAction(): Promise<void> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'accounting')
  const admin = createAdminClient()
  await admin
    .from('admin_notification_reads')
    .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() })
}
