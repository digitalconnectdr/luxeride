-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 36: Sección K — límites de uso reales por plan (vehículos,
-- choferes, reservas/mes, miembros de equipo) + fee por viaje (%) por plan,
-- reutilizando plan_quotas (mismo patrón que monthly_price y
-- live_tracking_monthly_quota). NULL = sin límite.
--
-- El fee por viaje YA existía como override manual por empresa
-- (companies.settings.payments.platform_fee_pct, ver app/actions/companies.ts)
-- — platform_fee_pct aquí es el DEFAULT por plan; el backfill de abajo lo
-- copia a settings.payments.platform_fee_pct de TODAS las empresas existentes
-- (decisión del usuario: la reestructuración aplica a empresas existentes y
-- nuevas por igual, no solo a registros nuevos).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plan_quotas
  ADD COLUMN max_vehicles INTEGER,
  ADD COLUMN max_drivers INTEGER,
  ADD COLUMN max_bookings_per_month INTEGER,
  ADD COLUMN max_team_members INTEGER,
  ADD COLUMN platform_fee_pct NUMERIC(4,2) NOT NULL DEFAULT 0;

INSERT INTO public.plan_quotas (plan, max_vehicles, max_drivers, max_bookings_per_month, max_team_members, platform_fee_pct)
VALUES
  ('free',         2,    2,    20,   1,    0),
  ('starter',      6,    6,    150,  2,    3.00),
  ('professional', 15,   15,   NULL, 8,    1.50),
  ('elite',        NULL, NULL, NULL, NULL, 0.50),
  ('enterprise',   NULL, NULL, NULL, NULL, 0)
ON CONFLICT (plan) DO UPDATE SET
  max_vehicles            = EXCLUDED.max_vehicles,
  max_drivers             = EXCLUDED.max_drivers,
  max_bookings_per_month  = EXCLUDED.max_bookings_per_month,
  max_team_members        = EXCLUDED.max_team_members,
  platform_fee_pct        = EXCLUDED.platform_fee_pct;

-- Backfill: aplicar el fee por defecto del plan a TODAS las empresas
-- existentes (no solo registros nuevos). Un super-admin puede seguir
-- sobreescribiendo el valor por empresa después desde
-- /super-admin/companies/[id] — este backfill solo fija el punto de partida.
UPDATE public.companies c
SET settings = jsonb_set(
  COALESCE(c.settings, '{}'::jsonb),
  '{payments,platform_fee_pct}',
  to_jsonb(pq.platform_fee_pct),
  true
)
FROM public.plan_quotas pq
WHERE pq.plan = c.plan;
