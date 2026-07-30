-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 82: Blindaje de cuentas corporativas — onboarding por link.
--
-- addCorporateMemberAction (app/actions/corporate.ts) exige que el invitado YA
-- tenga cuenta LuxeRide. Este token agrega una alternativa: invitar por link a
-- alguien que todavía no tiene cuenta (o que sí la tiene, sin pedirle password
-- de nuevo). Clon del patrón ya establecido en affiliate_invite_tokens
-- (migración 45) — capability-URL de un solo uso, tabla dedicada, RLS
-- habilitada SIN políticas (solo se toca vía service-role: server actions +
-- la página pública de aceptación, mismo patrón que /track/[id]).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.corporate_invite_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_account_id  UUID NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  token                 TEXT NOT NULL UNIQUE,
  email                 TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('manager', 'user')),
  spending_limit        NUMERIC(10, 2),
  monthly_limit         NUMERIC(10, 2),
  cost_center           TEXT,
  created_by            UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  used_at               TIMESTAMPTZ,
  used_by_user_id       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_corporate_invite_tokens_account ON public.corporate_invite_tokens(corporate_account_id);

ALTER TABLE public.corporate_invite_tokens ENABLE ROW LEVEL SECURITY;
-- Sin políticas — solo se toca vía service-role, mismo patrón que
-- affiliate_invite_tokens (migración 45).
