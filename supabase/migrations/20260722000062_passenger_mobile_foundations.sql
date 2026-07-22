-- ── Fundaciones para la app nativa de pasajero (Sprint 0) ──────────────────
-- customers_select_own_trip_locations: RLS nueva, barata y sin efecto hasta
-- que exista la pantalla de mapa en vivo (Sprint 2) — permite que un
-- pasajero autenticado (rol 'customer') lea directo por Supabase Realtime
-- la posición del conductor en SUS propias reservas, en vez de depender de
-- service-role como hoy hace el guest anónimo.
--
-- (Nota: esta migración originalmente agregaba también una columna
-- stripe_customer_id en user_profiles, pensada para el pago de Sprint 3 —
-- se quitó antes de aplicar porque el pago real de la plataforma es Whop
-- Connect, no Stripe; ver docs/PHASE-2-MOBILE.md. El Sprint 3 definirá el
-- campo correcto sobre el modelo de passenger_whop_members existente.)

CREATE POLICY "customers_select_own_trip_locations" ON public.trip_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = trip_locations.booking_id
      AND bookings.customer_id = auth.uid()
    )
  );
