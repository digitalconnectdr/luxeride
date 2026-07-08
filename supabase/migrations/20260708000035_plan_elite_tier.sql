-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 35: Sección K — Reestructuración de planes. Agrega el tier "elite"
-- entre Professional y Enterprise (red de afiliados, apps móviles incluidas,
-- fee por viaje más bajo). ALTER TYPE ... ADD VALUE va en su propio archivo
-- porque Postgres no permite usar el valor nuevo del enum en la MISMA
-- transacción en la que se agrega — la migración 36 (que sí usa 'elite' en
-- un INSERT) corre después, en su propia transacción.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE company_plan ADD VALUE IF NOT EXISTS 'elite' AFTER 'professional';
