-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 74: cargos adicionales recurrentes por empresa (LuxeRide cobra al
-- operador, no al revés). Ejemplo de uso: hosting de dominio personalizado
-- cuando LuxeRide compró el dominio y su costo real varía por disponibilidad
-- (no tiene precio fijo, por eso se gestiona como un cargo manual por
-- empresa en vez de un plan de Whop con precio único).
--
-- Arquitectura: el operador guarda una tarjeta con la cuenta PADRE de Whop de
-- LuxeRide (WHOP_PARENT_COMPANY_ID, ver lib/whop/connect-server.ts) — mismo
-- mecanismo de "setup checkout" ya usado para que los PASAJEROS guarden
-- tarjeta con cada operador, solo que aquí es LuxeRide quien cobra. Un cron
-- diario (app/api/cron/company-extra-charges) revisa qué cargos están
-- vencidos y los cobra contra esa tarjeta guardada.
--
-- company_extra_charges = la PLANTILLA del cargo recurrente (monto, frecuencia,
-- próxima fecha). company_extra_charge_payments = el HISTORIAL de cada cobro
-- individual ya ejecutado — tabla separada a propósito para poder reversar
-- (acreditar) UN cobro puntual sin afectar los demás (ej. si por error se
-- cobró dos veces, se reversa solo uno de los dos).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN whop_billing_member_id TEXT,
  ADD COLUMN whop_billing_card_saved_at TIMESTAMPTZ;

CREATE TABLE public.company_extra_charges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  currency          TEXT NOT NULL DEFAULT 'usd',
  -- 1 = mensual, 12 = anual (dominio típicamente se renueva 1 vez al año).
  frequency_months  INTEGER NOT NULL DEFAULT 1 CHECK (frequency_months IN (1, 12)),
  next_charge_date  DATE NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE extra_charge_payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE public.company_extra_charge_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_charge_id  UUID NOT NULL REFERENCES public.company_extra_charges(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount_cents     INTEGER NOT NULL,
  currency         TEXT NOT NULL,
  status           extra_charge_payment_status NOT NULL,
  whop_payment_id  TEXT,
  failure_message  TEXT,
  charged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_at      TIMESTAMPTZ,
  refunded_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  refund_reason    TEXT
);

CREATE INDEX idx_company_extra_charges_due ON public.company_extra_charges(next_charge_date) WHERE active = true;
CREATE INDEX idx_company_extra_charges_company ON public.company_extra_charges(company_id);
CREATE INDEX idx_extra_charge_payments_charge ON public.company_extra_charge_payments(extra_charge_id, charged_at DESC);
CREATE INDEX idx_extra_charge_payments_company ON public.company_extra_charge_payments(company_id);

ALTER TABLE public.company_extra_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_extra_charge_payments ENABLE ROW LEVEL SECURITY;

-- Solo super_admin crea/edita/pausa cargos (siempre vía Server Action con
-- service role); el operador solo puede LEER los suyos (transparencia en su
-- propio panel de Configuración), nunca crear ni modificar.
CREATE POLICY "super_admin_manages_extra_charges"
  ON public.company_extra_charges FOR ALL
  USING (public.auth_has_role('super_admin'));

CREATE POLICY "company_members_read_own_extra_charges"
  ON public.company_extra_charges FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "super_admin_manages_extra_charge_payments"
  ON public.company_extra_charge_payments FOR ALL
  USING (public.auth_has_role('super_admin'));

CREATE POLICY "company_members_read_own_extra_charge_payments"
  ON public.company_extra_charge_payments FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));
