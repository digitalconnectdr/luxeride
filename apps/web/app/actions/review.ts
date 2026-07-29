'use server'
// ── Reseña post-viaje (pública) ────────────────────────────────────────────────
// El pasajero recibe un link /review/<bookingId> por email al completar el viaje.
// Sin auth: el bookingId (UUID) es el secreto, igual que /track/<id>. Solo se
// permite calificar UNA vez y solo viajes completados.

import { revalidatePath } from 'next/cache'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'
import { grantRewardsForBooking } from '@/lib/rewards/grant'

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
    .select('id, status, rated_at, company_id, customer_id, passenger_email, passenger_phone')
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

  // Recompensa por HABER reseñado, sin mirar la puntuación (ver la cabecera de
  // lib/rewards/engine.ts). En background: la reseña ya se guardó y no puede
  // fallar porque una regla de descuento falle.
  waitUntil(
    grantRewardsForBooking({
      companyId: booking.company_id,
      bookingId,
      customerEmail: booking.passenger_email,
      customerPhone: booking.passenger_phone,
      customerId: booking.customer_id,
      justSubmittedReview: true,
    }),
  )

  revalidatePath(`/review/${bookingId}`)
  return { success: true }
}
