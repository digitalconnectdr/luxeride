-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 75: centro de notificaciones del PASAJERO (app móvil).
--
-- Mismo patrón que admin_notifications (migración 60), pero scopeado al
-- customer en vez de a la empresa: la RLS de admin_notifications exige rol de
-- staff (auth_has_role('company_owner',...)), así que un pasajero nunca podría
-- leer de ahí — necesita su propia tabla.
--
-- El vacío que llena: la app YA manda push nativo en los momentos clave
-- (conductor asignado, en camino, llegó, viaje completado/cancelado,
-- recordatorio de viaje, re-engagement). Pero un push es efímero: si el
-- pasajero lo descarta o el teléfono estaba apagado, ese aviso se pierde para
-- siempre y no hay dónde volver a verlo. Aquí queda el registro persistente.
--
-- A partir de ahora los avisos se insertan desde notifyPassenger()
-- (lib/notifications/passenger-feed.ts), que hace el INSERT y el push en la
-- misma llamada — así es imposible que uno ocurra sin el otro.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.passenger_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'driver_assigned' | 'driver_en_route' | 'driver_arrived' | 'trip_completed'
  -- | 'booking_cancelled' | 'booking_reminder' | 'reengagement' | 'chat_message'
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  -- Viaje relacionado, para que tocar el aviso lleve al seguimiento correcto.
  -- ON DELETE SET NULL: si la reserva se borra, el aviso histórico sobrevive
  -- sin puntero roto (y la app deja de ofrecer la navegación).
  booking_id  UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query principal de la campana: mis avisos, más recientes primero.
CREATE INDEX idx_passenger_notifications_customer_created
  ON public.passenger_notifications(customer_id, created_at DESC);

ALTER TABLE public.passenger_notifications ENABLE ROW LEVEL SECURITY;

-- El pasajero solo ve los suyos. Sin política de INSERT/UPDATE/DELETE para
-- authenticated: los avisos los crea siempre el service-role (server actions y
-- crons), nunca el cliente — si no, cualquiera podría fabricarse avisos.
CREATE POLICY "customers_read_own_notifications"
  ON public.passenger_notifications FOR SELECT
  USING (customer_id = auth.uid());

-- ── Estado de lectura (mismo patrón que admin_notification_reads) ────────────
-- Una sola marca de agua por usuario en vez de un booleano por aviso: lo que
-- la campana necesita saber es "¿hay algo posterior a la última vez que
-- abrí?", y eso se responde con una comparación de fechas, sin escribir una
-- fila por cada aviso leído.
CREATE TABLE public.passenger_notification_reads (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.passenger_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_manage_own_notification_reads"
  ON public.passenger_notification_reads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
