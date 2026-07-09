-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 41: checkout real de Whop para el add-on de Affiliate Network
-- (Starter/Professional). Se rastrea su membresía POR SEPARADO de la
-- suscripción principal (whop_membership_id) porque son ciclos de cobro
-- independientes: cancelar el add-on debe apagar SOLO
-- affiliate_network_enabled, nunca suspender la cuenta completa.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN affiliate_network_whop_membership_id TEXT;

CREATE INDEX idx_companies_affiliate_whop_membership
  ON public.companies(affiliate_network_whop_membership_id)
  WHERE affiliate_network_whop_membership_id IS NOT NULL;
