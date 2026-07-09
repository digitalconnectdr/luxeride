-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 38: el plan "elite" (agregado en la migración 35) nunca recibió
-- un valor de live_tracking_monthly_quota — su fila en plan_quotas quedó con
-- el default NULL, que el código interpreta como "sin límite" (igual que
-- Enterprise). El campo YA es editable desde /super-admin/tracking para
-- cualquier plan (updatePlanQuotaAction hace un UPDATE genérico por `plan`),
-- así que esto solo fija un punto de partida real en vez de dejarlo en
-- "sin límite" por omisión.
--
-- También fija monthly_price a su precio real de venta ($548.99) — quedó en
-- el default 0 por el mismo motivo (columna agregada sin backfill, se llena
-- manualmente desde el panel) y afectaba el cálculo de MRR en el cuadro de
-- mando de super-admin para cualquier empresa Elite.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.plan_quotas
SET live_tracking_monthly_quota = 25000,
    monthly_price = 548.99
WHERE plan = 'elite';
