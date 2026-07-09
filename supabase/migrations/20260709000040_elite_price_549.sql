-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 40: el precio real del plan Elite en Whop se ajustó de $548.99 a
-- $549 (checkout ya actualizado por el usuario). Refleja el nuevo monto en
-- plan_quotas.monthly_price, usado para el cálculo de MRR en el cuadro de
-- mando de super-admin — el landing ya se actualizó por separado (código).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.plan_quotas
SET monthly_price = 549.00
WHERE plan = 'elite';
