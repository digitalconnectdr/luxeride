-- Migration 49: esquema para 3 add-ons de pago nuevos (docs/PENDING.md,
-- "Gaps mayores"): nomina de conductores, firma electronica, codigos
-- promocionales. Mismo espiritu que el add-on de Red de Afiliados (Whop,
-- incluido en Elite/Enterprise) pero generalizado en una sola tabla
-- reusable en vez de repetir columnas booleanas en companies por cada addon.

-- ── company_addons: estado generico de cada add-on por empresa ──────────────
CREATE TABLE public.company_addons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  addon_key           TEXT NOT NULL,
  enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_at          TIMESTAMPTZ,
  whop_membership_id  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, addon_key)
);

CREATE INDEX idx_company_addons_company ON public.company_addons(company_id);
CREATE INDEX idx_company_addons_membership ON public.company_addons(whop_membership_id) WHERE whop_membership_id IS NOT NULL;

ALTER TABLE public.company_addons ENABLE ROW LEVEL SECURITY;

-- ── Nomina de conductores: solo calculo y reporte, sin mover dinero real ────
ALTER TABLE public.drivers
  ADD COLUMN payroll_type TEXT CHECK (payroll_type IN ('commission', 'flat_per_trip')),
  ADD COLUMN payroll_rate NUMERIC(10, 2);

-- Snapshot de un periodo ya marcado como pagado (el reporte de periodos SIN
-- marcar se calcula al vuelo desde bookings, igual que puntualidad/rating de
-- conductores en /admin/drivers/[id] - sin columnas contadoras que mantener
-- sincronizadas). Al marcar "pagado" se congela el monto/viajes de ESE
-- momento, para que un cambio posterior de payroll_rate no altere periodos
-- ya liquidados.
CREATE TABLE public.payroll_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id        UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  trips_count      INTEGER NOT NULL,
  total_amount     NUMERIC(10, 2) NOT NULL,
  marked_paid_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_paid_by   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (driver_id, period_start, period_end)
);

CREATE INDEX idx_payroll_payments_company ON public.payroll_payments(company_id);
CREATE INDEX idx_payroll_payments_driver ON public.payroll_payments(driver_id);

ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;

-- ── Firma electronica: acuerdo del conductor + contrato de cuenta corporativa
-- Tabla generica (subject_type/subject_id) en vez de una tabla separada por
-- cada tipo de documento - misma estructura exacta para ambos casos.
CREATE TABLE public.signed_agreements (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subject_type              TEXT NOT NULL CHECK (subject_type IN ('driver', 'corporate_account')),
  subject_id                UUID NOT NULL,
  document_version          TEXT NOT NULL,
  agreement_text_snapshot   TEXT NOT NULL,
  signature_image_path      TEXT NOT NULL,
  signed_by_name            TEXT NOT NULL,
  signed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address                TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signed_agreements_subject ON public.signed_agreements(subject_type, subject_id);
CREATE INDEX idx_signed_agreements_company ON public.signed_agreements(company_id);

ALTER TABLE public.signed_agreements ENABLE ROW LEVEL SECURITY;

-- ── Codigos promocionales ────────────────────────────────────────────────────
CREATE TABLE public.promo_codes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code                      TEXT NOT NULL,
  discount_type             TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value            NUMERIC(10, 2) NOT NULL,
  max_uses                  INTEGER,
  uses_count                INTEGER NOT NULL DEFAULT 0,
  max_uses_per_customer     INTEGER,
  valid_from                TIMESTAMPTZ,
  valid_until               TIMESTAMPTZ,
  min_booking_amount        NUMERIC(10, 2),
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_promo_codes_company ON public.promo_codes(company_id);

CREATE TABLE public.promo_code_redemptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id     UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  booking_id        UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_phone    TEXT,
  customer_email    TEXT,
  discount_amount   NUMERIC(10, 2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_redemptions_code ON public.promo_code_redemptions(promo_code_id);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- bookings: que codigo (si alguno) se aplico y cuanto se descunto
ALTER TABLE public.bookings
  ADD COLUMN promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN promo_discount_amount NUMERIC(10, 2);
