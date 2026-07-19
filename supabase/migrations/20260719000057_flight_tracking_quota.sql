-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 57: cuota mensual de seguimiento de vuelos por plan (protege la
-- cuota compartida de la API externa -- AeroDataBox/FlightAware -- sin
-- importar cuánto crezca un operador) + contador de consumo real por empresa.
-- Mismo patrón que la migración 20 (live_tracking_monthly_quota +
-- live_tracking_usage), aplicado a las consultas de estado de vuelo.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plan_quotas
  ADD COLUMN flight_tracking_monthly_quota INTEGER;

UPDATE public.plan_quotas SET flight_tracking_monthly_quota = 30  WHERE plan = 'free';
UPDATE public.plan_quotas SET flight_tracking_monthly_quota = 150 WHERE plan = 'starter';
UPDATE public.plan_quotas SET flight_tracking_monthly_quota = 400 WHERE plan = 'professional';
-- elite y enterprise quedan en NULL = sin límite (mismo criterio que live_tracking_monthly_quota)

-- Contador de uso mensual por empresa: cuántas consultas de estado de vuelo
-- consumió cada operador este mes.
CREATE TABLE public.flight_tracking_usage (
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year_month   TEXT NOT NULL,  -- 'YYYY-MM'
  lookup_count INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, year_month)
);

ALTER TABLE public.flight_tracking_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_flight_tracking_usage"
  ON public.flight_tracking_usage FOR SELECT
  USING (public.auth_has_role('super_admin'));
