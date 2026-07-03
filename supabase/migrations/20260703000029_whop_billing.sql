-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 29: Facturación de acceso a la plataforma vía Whop (Parte A).
-- Reemplaza (complementa) la aprobación manual en /super-admin/subscriptions
-- con activación automática cuando el operador paga a través de Whop.
-- Correlación por email: el webhook de Whop trae el email del comprador, se
-- compara contra companies.email para saber qué empresa activar.
-- whop_membership_id sirve de guarda de idempotencia (Whop puede reintentar
-- el mismo evento) y whop_plan_id queda como dato crudo de soporte/depuración.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS whop_membership_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS whop_plan_id TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies (lower(email)) WHERE email IS NOT NULL;
