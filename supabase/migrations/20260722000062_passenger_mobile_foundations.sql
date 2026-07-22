-- ── Fundaciones para la app nativa de pasajero (Sprint 0) ──────────────────
-- 1) stripe_customer_id: reservado para Sprint 3 (tarjeta guardada vía
--    Stripe Customer + SetupIntent). Se agrega ya para no tener que tocar
--    database.types.ts dos veces.
-- 2) customers_select_own_trip_locations: RLS nueva, barata y sin efecto
--    hasta que exista la pantalla de mapa en vivo (Sprint 2) — permite que
--    un pasajero autenticado (rol 'customer') lea directo por Supabase
--    Realtime la posición del conductor en SUS propias reservas, en vez de
--    depender de service-role como hoy hace el guest anónimo.

ALTER TABLE public.user_profiles ADD COLUMN stripe_customer_id TEXT;

CREATE POLICY "customers_select_own_trip_locations" ON public.trip_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = trip_locations.booking_id
      AND bookings.customer_id = auth.uid()
    )
  );
