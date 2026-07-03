-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 25: Precio mensual por plan (para calcular MRR real en el
-- cuadro de mando de super-admin). plan_quotas ya era la tabla de config
-- por plan (hoy solo cuota de tracking) — se reutiliza en vez de crear una
-- tabla nueva. Precio en 0 por defecto (el super-admin lo define desde
-- /super-admin/tracking).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plan_quotas
  ADD COLUMN monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0;
