-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 32: Whop Connect (Parte B) — que los operadores cobren a sus
-- pasajeros vía Whop, como segundo riel de pago junto a Stripe Connect.
-- Mismo patrón que stripe_connect_account_id/stripe_connect_onboarded.
-- active_payment_provider: cuál de los dos rieles conectados se usa
-- realmente para cobrar (nullable — si es NULL, el código sigue el
-- comportamiento actual de "usar Stripe si está onboarded").
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS whop_connect_company_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS whop_connect_onboarded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_payment_provider TEXT
    CHECK (active_payment_provider IS NULL OR active_payment_provider IN ('stripe', 'whop'));

-- Referencia al checkout de Whop de un pago puntual (viaje), análogo a
-- stripe_payment_intent_id — permite reconciliar el webhook con la fila.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS whop_checkout_id TEXT UNIQUE;
