-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 30: Idempotencia correcta para el webhook de Whop.
-- Antes se usaba whop_membership_id para decidir si "ya procesamos este
-- evento" — pero eso bloquea un cambio de plan LEGÍTIMO sobre la misma
-- membresía (upgrade/downgrade Starter↔Professional). whop_last_event_id
-- guarda el ID de la ENTREGA del webhook (distinto del ID de la membresía),
-- así solo se ignoran reintentos exactos del mismo evento, no eventos
-- nuevos y válidos que comparten membership_id.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS whop_last_event_id TEXT;
