// ── Broadcast en vivo del viaje (posición del conductor + estado) ─────────────
// Por qué Broadcast y no `postgres_changes`: el pasajero de la web NO tiene
// sesión (el UUID de la reserva es la capability URL), así que las políticas
// RLS de `trip_locations` nunca lo dejan recibir eventos de Realtime — la
// suscripción existía desde julio pero para él era código muerto, y caía
// siempre al sondeo de 15s. Un canal de Broadcast no pasa por RLS de tabla:
// el servidor publica y cualquier cliente suscrito al topic lo recibe al
// instante, con o sin sesión.
//
// Seguridad: el topic incluye el UUID de la reserva, que ya ES el secreto que
// protege toda la página /track/[id] (mismo modelo que trip.ts y el resto de
// acciones públicas del viaje). Quien conoce el UUID ya podía ver la posición
// sondeando; esto no amplía la superficie, solo la entrega más rápido. NUNCA
// meter en el payload nada que la página no muestre ya.
//
// Se publica por HTTP (no abriendo un websocket desde el servidor): en
// funciones serverless mantener una conexión viva por request es caro y
// frágil. El endpoint /realtime/v1/api/broadcast está pensado exactamente
// para esto.

export type TripBroadcastEvent = 'driver_position' | 'passenger_position' | 'status'

/** Nombre del canal de un viaje. Debe coincidir exactamente con el que usa el cliente. */
export function tripChannelName(bookingId: string): string {
  return `trip:${bookingId}`
}

/**
 * Publica un evento al canal del viaje. Nunca lanza: si Realtime falla, el
 * sondeo de respaldo del cliente sigue cubriendo el caso (degradación amable,
 * jamás romper el reporte de GPS por un fallo de entrega en vivo).
 */
export async function broadcastTripEvent(
  bookingId: string,
  event: TripBroadcastEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic: tripChannelName(bookingId), event, payload }],
      }),
    })
  } catch {
    // Entrega en vivo best-effort — el cliente tiene sondeo de respaldo.
  }
}
