-- Migration 51: Partner Portals (hoteles, FBOs, wedding/event planners, etc.)
-- Canal B2B de referidos con link privado co-brandeado, distinto de:
--   - Cuentas Corporativas (corporate_accounts): la empresa cliente PAGA/tiene
--     credito. Un partner NO paga - el pasajero referido paga directo, y el
--     OPERADOR le paga una comision al partner por fuera de la plataforma.
--   - Red de Afiliados (affiliate_trips): es entre operadores de LuxeRide con
--     flota propia. Un hotel/FBO/wedding planner no tiene choferes ni
--     vehiculos, solo refiere clientes.
-- Incluido en el plan (Professional+), sin cobro aparte - no usa el sistema
-- de company_addons/Whop como los add-ons de IA.

CREATE TABLE public.partners (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  logo_url              TEXT,
  contact_name          TEXT,
  contact_email         TEXT,
  contact_phone         TEXT,
  -- Tarifa especial: % aplicado al total de la cotizacion al reservar desde
  -- el link de este partner. Negativo = descuento, positivo = recargo.
  -- Default 0 = misma tarifa que el publico general.
  rate_adjustment_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Comision del operador hacia el partner - solo calculo/reporte, igual que
  -- payroll_payments (nunca mueve dinero real).
  commission_type       TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value      NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, slug)
);

CREATE INDEX idx_partners_company ON public.partners(company_id);
CREATE INDEX idx_partners_active ON public.partners(company_id, is_active);

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_select_partners"
  ON public.partners FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY "admins_manage_partners"
  ON public.partners FOR ALL
  USING (
    company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin')
  );

-- ── bookings: que partner (si alguno) refirio esta reserva ─────────────────
-- Nullable, separada de corporate_account_id a proposito (semantica distinta:
-- facturacion B2B vs. referido con comision).
ALTER TABLE public.bookings
  ADD COLUMN partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_partner ON public.bookings(partner_id) WHERE partner_id IS NOT NULL;

-- ── partner_payments: snapshot congelado de comision ya "pagada" ────────────
-- Mismo espiritu que payroll_payments: al marcar un periodo como pagado se
-- congela el monto/reservas exactos de ESE momento, para que un cambio
-- posterior de commission_value no altere periodos ya liquidados.
CREATE TABLE public.partner_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id       UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  trips_count      INTEGER NOT NULL,
  total_amount     NUMERIC(10, 2) NOT NULL,
  marked_paid_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_paid_by   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, period_start, period_end)
);

CREATE INDEX idx_partner_payments_company ON public.partner_payments(company_id);
CREATE INDEX idx_partner_payments_partner ON public.partner_payments(partner_id);

ALTER TABLE public.partner_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_select_partner_payments"
  ON public.partner_payments FOR SELECT
  USING (company_id = public.auth_company_id());
