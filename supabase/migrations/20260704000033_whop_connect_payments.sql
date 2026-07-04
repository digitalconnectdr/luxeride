-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 33: Whop Connect (Parte B, fase 2) — cobro real por viaje.
-- whop_payment_id: el ID del payment real de Whop (distinto del
-- whop_checkout_id de la migración 32, que es la configuración de checkout
-- creada ANTES de que el pasajero pague) — se necesita para poder emitir
-- reembolsos vía client.payments.refund(whop_payment_id). Análogo a
-- stripe_payment_intent_id/stripe_charge_id.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS whop_payment_id TEXT UNIQUE;

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS whop_refund_id TEXT UNIQUE;
