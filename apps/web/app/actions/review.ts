'use server'
// ── Reseña post-viaje (pública) ────────────────────────────────────────────────
// El pasajero recibe un link /review/<bookingId> por email al completar el viaje.
// Sin auth: el bookingId (UUID) es el secreto, igual que /track/<id>. Solo se
// permite calificar UNA vez y solo viajes completados.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'

export async function submitReviewAction(
  bookingId: string,
  rating: number,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  const stars = Math.round(Number(rating))
  if (!bookingId || !Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { success: false, error: 'invalid_rating' }
  }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, rated_at')
    .eq('id', bookingId)
    .single()

  if (!booking) return { success: false, error: 'not_found' }
  if (booking.status !== 'completed') return { success: false, error: 'not_completed' }
  if (booking.rated_at) return { success: false, error: 'already_rated' }

  const trimmed = comment.trim().slice(0, 1000)
  const { error } = await admin
    .from('bookings')
    .update({
      rating: stars,
      rating_comment: trimmed || null,
      rated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .is('rated_at', null) // guard de carrera: no sobrescribir si ya se calificó

  if (error) {
    console.error('[submitReviewAction]', error)
    return { success: false, error: 'save_failed' }
  }

  revalidatePath(`/review/${bookingId}`)
  return { success: true }
}
