'use server'
// ── Solicitudes de "recomendar función" / "reportar problema" ─────────────────
// Botón junto al ícono de Ayuda en la barra superior del admin -- cualquier
// rol que ve ese panel puede enviar una, y el super-admin las gestiona desde
// /super-admin/feature-requests.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { FeatureRequestSource, FeatureRequestStatus, FeatureRequestType } from '@/lib/supabase/database.types'

export type FeatureRequestResult = { success: boolean; error?: string }

export async function submitFeatureRequestAction(formData: FormData): Promise<FeatureRequestResult> {
  const user = await requireRole('super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting', 'driver')

  const type        = formData.get('type') as string
  const title        = (formData.get('title') as string ?? '').trim()
  const description  = (formData.get('description') as string ?? '').trim()

  if (type !== 'feature' && type !== 'bug') return { success: false, error: 'Tipo inválido' }
  if (!title)       return { success: false, error: 'Título requerido' }
  if (!description) return { success: false, error: 'Descripción requerida' }

  const source: FeatureRequestSource = user.role === 'driver' ? 'driver' : 'admin'

  const admin = createAdminClient()
  const { error } = await admin.from('feature_requests').insert({
    company_id:   user.company_id,
    requested_by: user.id,
    type: type as FeatureRequestType,
    title,
    description,
    source,
  })

  if (error) {
    console.error('[submitFeatureRequestAction]', error)
    return { success: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  return { success: true }
}

// Página pública de tracking (/track/[id]) -- sin sesión, la única prueba de
// acceso es el booking_id (URL de capacidad). Nunca confiar en un company_id
// que venga del cliente: se re-deriva aquí desde el booking.
export async function submitPublicFeatureRequestAction(formData: FormData): Promise<FeatureRequestResult> {
  const type        = formData.get('type') as string
  const title        = (formData.get('title') as string ?? '').trim()
  const description  = (formData.get('description') as string ?? '').trim()
  const bookingId    = (formData.get('booking_id') as string ?? '').trim()

  if (type !== 'feature' && type !== 'bug') return { success: false, error: 'Tipo inválido' }
  if (!title)       return { success: false, error: 'Título requerido' }
  if (!description) return { success: false, error: 'Descripción requerida' }
  if (!bookingId)    return { success: false, error: 'Solicitud inválida' }

  const admin = createAdminClient()
  const { data: booking } = await admin.from('bookings').select('company_id').eq('id', bookingId).single()
  if (!booking) return { success: false, error: 'Solicitud inválida' }

  const { error } = await admin.from('feature_requests').insert({
    company_id:   booking.company_id,
    requested_by: null,
    type: type as FeatureRequestType,
    title,
    description,
    source: 'customer',
  })

  if (error) {
    console.error('[submitPublicFeatureRequestAction]', error)
    return { success: false, error: 'No se pudo enviar la solicitud. Intenta de nuevo.' }
  }

  return { success: true }
}

export async function updateFeatureRequestStatusAction(
  requestId: string,
  status: FeatureRequestStatus,
): Promise<FeatureRequestResult> {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { error } = await admin.from('feature_requests').update({ status }).eq('id', requestId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/super-admin/feature-requests')
  return { success: true }
}
