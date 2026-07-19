'use client'
// ── Alerta de viaje nuevo (portal web del conductor) ───────────────────────────
// /driver/trips es un Server Component que se re-ejecuta entero en cada
// AutoRefresh (router.refresh()) — no hay estado de cliente que sobreviva entre
// renders para saber "esta reserva no estaba antes". Este wrapper sí lo tiene:
// compara los IDs de viajes activos recibidos por props contra los del render
// anterior (useRef) y avisa (toast + sonido) por cada uno que apareció nuevo.

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { playAlertChime } from '@/lib/notifications/chime'

interface ActiveTripSummary {
  id: string
  bookingNumber: string
}

export function NewTripAlert({ trips, newTripLabel }: { trips: ActiveTripSummary[]; newTripLabel: string }) {
  const seenIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    const currentIds = new Set(trips.map((t) => t.id))

    // Primer render (o el conductor entra con viajes ya asignados): solo
    // registrar, no alertar retroactivamente por lo que ya existía.
    if (seenIds.current) {
      const fresh = trips.filter((t) => !seenIds.current!.has(t.id))
      fresh.forEach((t) => toast(newTripLabel.replace('{number}', t.bookingNumber)))
      if (fresh.length > 0) playAlertChime()
    }

    seenIds.current = currentIds
  }, [trips, newTripLabel])

  return null
}
