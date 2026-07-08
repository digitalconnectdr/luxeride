-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 37: fix del backfill de la migración 36. jsonb_set con un path
-- anidado de 2 niveles ('{payments,platform_fee_pct}') NO crea el objeto
-- padre 'payments' cuando falta por completo, incluso con create_missing=true
-- — solo agrega la clave final si el padre ya existe. Empresas cuyo settings
-- nunca tuvo la clave 'payments' quedaron sin el backfill (silenciosamente en
-- 0%, en vez de su fee real de plan). Se corrige haciendo jsonb_set sobre el
-- objeto 'payments' completo (path de 1 nivel), que sí crea la clave si falta.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.companies c
SET settings = jsonb_set(
  COALESCE(c.settings, '{}'::jsonb),
  '{payments}',
  COALESCE(c.settings->'payments', '{}'::jsonb) || jsonb_build_object('platform_fee_pct', pq.platform_fee_pct),
  true
)
FROM public.plan_quotas pq
WHERE pq.plan = c.plan
  AND (c.settings->'payments'->'platform_fee_pct') IS NULL;
