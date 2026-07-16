-- Migration 54: Programa de referidos entre empresas (comisión escalonada)
-- Una empresa (referrer) invita a otra (referred) a unirse a LuxeRide. El %
-- de comisión que gana el referrer queda CONGELADO al momento exacto en que
-- referred se une (nivel vigente del referrer en ESE instante, no el nivel
-- actual), y expira automaticamente a los 12 meses de actividad de referred.
-- El pago real de la comision se hace via Whop (affiliate + override), pero
-- esta tabla es la fuente de verdad interna: quien refirio a quien, el %
-- congelado, y el reloj de 12 meses de cada referido individual.
--
-- Niveles (definidos tambien en lib/referrals/tiers.ts, mantener en sync):
--   iniciado  1-3 referidos activos   5%
--   socio     4-6 referidos activos   8%
--   aliado    7-11 referidos activos  12%
--   embajador 12+ referidos activos   15%

CREATE TABLE public.company_referrals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  referred_company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tier_key              TEXT NOT NULL CHECK (tier_key IN ('iniciado', 'socio', 'aliado', 'embajador')),
  commission_pct        NUMERIC(5,2) NOT NULL,
  referred_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  -- Vinculo con Whop (affiliate + override) — se completa cuando se conecte
  -- la automatizacion de pagos; nulo mientras tanto (solo tracking interno).
  whop_affiliate_id     TEXT,
  whop_override_id      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_company_id),
  CHECK (referrer_company_id != referred_company_id)
);

CREATE INDEX idx_company_referrals_referrer ON public.company_referrals(referrer_company_id);
CREATE INDEX idx_company_referrals_active ON public.company_referrals(referrer_company_id, expires_at);

ALTER TABLE public.company_referrals ENABLE ROW LEVEL SECURITY;

-- Solo lectura de lo propio (como referrer o como referido) — la creacion y
-- el vencimiento los maneja el backend (service role), no el operador.
CREATE POLICY "company_members_select_own_referrals"
  ON public.company_referrals FOR SELECT
  USING (
    referrer_company_id = public.auth_company_id() OR
    referred_company_id = public.auth_company_id()
  );
