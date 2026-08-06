-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 89: monitoreo de sistema para el super-admin — panel único que
-- reporta si Supabase, Vercel, GPS/tracking en vivo y las integraciones
-- externas (Twilio, Resend, Stripe, Whop, Google Maps, OpenAI, AeroDataBox)
-- están funcionando, más el tamaño de la base de datos vs la capacidad del
-- plan. Los chequeos corren bajo demanda (botón "Verificar ahora") o desde
-- el cron protegido — nunca en un loop constante — así que esta tabla solo
-- guarda el ÚLTIMO resultado por servicio, no un historial.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.system_health_checks (
  service      TEXT PRIMARY KEY,
  status       TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('ok', 'degraded', 'down', 'unknown')),
  message      TEXT,
  response_ms  INTEGER,
  meta         JSONB,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- Solo lectura para super-admins — la escritura la hace siempre el admin
-- client (service role) desde el cron o la server action "Verificar ahora",
-- nunca directo desde el cliente.
CREATE POLICY "super_admin_select_system_health"
  ON public.system_health_checks FOR SELECT
  USING (public.auth_has_role('super_admin'));

-- Tamaño real de la base de datos en bytes — pg_database_size() no está
-- expuesto por el cliente REST de Supabase, así que se envuelve en una
-- función SECURITY DEFINER, callable solo por el service role (el chequeo
-- de Supabase la invoca vía admin.rpc()).
CREATE OR REPLACE FUNCTION public.get_database_size_bytes()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_database_size(current_database());
$$;

REVOKE ALL ON FUNCTION public.get_database_size_bytes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_database_size_bytes() TO service_role;
