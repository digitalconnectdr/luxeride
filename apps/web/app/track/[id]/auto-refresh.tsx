'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Refresca la página del viaje.
 *
 * Dos vías complementarias:
 *  1. `bookingId` (recomendado): escucha el canal en vivo del viaje y refresca
 *     EN EL ACTO cuando el conductor o el staff cambian el estado. Es lo que
 *     hace que "Conductor en camino" aparezca al segundo en vez de cuando
 *     toque el próximo sondeo.
 *  2. `seconds`: sondeo de respaldo, por si el websocket se cae o el evento se
 *     pierde. Ya no es la vía principal, así que puede ser mucho más espaciado.
 */
export function AutoRefresh({ seconds, bookingId }: { seconds: number; bookingId?: string }) {
  const router = useRouter()

  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])

  useEffect(() => {
    if (!bookingId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`trip:${bookingId}`)
      .on('broadcast', { event: 'status' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router, bookingId])

  return null
}
