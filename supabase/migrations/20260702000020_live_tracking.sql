-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20: Tracking GPS en vivo (conductor↔pasajero, solo viaje activo)
-- + cuotas de "refrescos" de mapa por plan (protege el margen del dueño de la
-- plataforma frente al costo de Google Maps) + medición de consumo por empresa.
-- ─────────────────────────────────────────────────────────────────────────────

-- Posición GPS reportada por el conductor y, opcionalmente (opt-in), el
-- pasajero. Solo se escribe mientras el viaje está en un estado activo.
CREATE TABLE public.trip_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reporter    TEXT NOT NULL CHECK (reporter IN ('driver', 'passenger')),
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trip_locations_booking ON public.trip_locations(booking_id, recorded_at DESC);

ALTER TABLE public.trip_locations ENABLE ROW LEVEL SECURITY;

-- El pasajero (capability URL sin login) y el conductor escriben/leen vía
-- server actions con service-role (mismo patrón que trip_messages/trip_reports),
-- así que aquí solo protegemos el acceso DIRECTO de clientes autenticados:
CREATE POLICY "drivers_insert_own_trip_location"
  ON public.trip_locations FOR INSERT
  WITH CHECK (
    reporter = 'driver' AND
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.driver_id = auth.uid())
  );

CREATE POLICY "company_members_select_trip_locations"
  ON public.trip_locations FOR SELECT
  USING (company_id = public.auth_company_id());

-- Realtime: el pasajero/conductor se suscriben por booking_id para ver la
-- posición moverse sin recargar la página.
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_locations;

-- ─────────────────────────────────────────────

-- Cuota mensual de refrescos de mapa en vivo incluida por plan (protege el
-- costo de Google Maps sin importar cuánto crezca un operador). Editable desde
-- /super-admin sin necesidad de deploy. NULL = sin límite (Enterprise).
CREATE TABLE public.plan_quotas (
  plan                        company_plan PRIMARY KEY,
  live_tracking_monthly_quota INTEGER,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.plan_quotas (plan, live_tracking_monthly_quota) VALUES
  ('free', 0),
  ('starter', 2500),
  ('professional', 8500),
  ('enterprise', NULL);

CREATE TRIGGER plan_quotas_updated_at
  BEFORE UPDATE ON public.plan_quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.plan_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage_plan_quotas"
  ON public.plan_quotas FOR ALL
  USING (public.auth_has_role('super_admin'));

-- ─────────────────────────────────────────────

-- Contador de uso mensual por empresa: cuántos refrescos de mapa en vivo
-- consumió cada operador este mes. Sirve para (a) hacer cumplir la cuota de
-- arriba y (b) darle al dueño de la plataforma visibilidad del consumo total
-- de LuxeRide (no existía antes de esta migración).
CREATE TABLE public.live_tracking_usage (
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year_month    TEXT NOT NULL,  -- 'YYYY-MM'
  refresh_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, year_month)
);

ALTER TABLE public.live_tracking_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_live_tracking_usage"
  ON public.live_tracking_usage FOR SELECT
  USING (public.auth_has_role('super_admin'));
