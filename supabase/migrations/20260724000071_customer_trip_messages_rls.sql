-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 71: chat pasajero autenticado (app móvil) — trip_messages
-- El pasajero de la web es siempre guest (sin sesión), así que su lado del
-- chat corre por server actions con service role (ver getTripMessagesAction/
-- sendClientMessageAction en app/actions/trip.ts, capability URL). El
-- pasajero de la app móvil SÍ tiene sesión (auth.uid()) — se le agrega el
-- mismo patrón de RLS que ya tiene el conductor (driver_reads/writes_trip_
-- messages, migración 18), para que la app pueda usar Supabase Realtime
-- directo sin pasar por una ruta nueva.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "customers_read_trip_messages"
  ON public.trip_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = trip_messages.booking_id AND b.customer_id = auth.uid()
  ));

CREATE POLICY "customers_write_trip_messages"
  ON public.trip_messages FOR INSERT
  WITH CHECK (
    sender = 'client' AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = trip_messages.booking_id AND b.customer_id = auth.uid()
    )
  );
