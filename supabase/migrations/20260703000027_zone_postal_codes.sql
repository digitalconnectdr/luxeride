-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 27: Códigos postales por zona (además del círculo center/radius
-- que ya existía). Permite definir una zona como una lista de códigos
-- postales (estilo Moovs) — el motor de precios usa el código postal primero
-- y el círculo como respaldo. Ver lib/pricing/zones.ts.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.service_zones
  ADD COLUMN postal_codes TEXT[] NOT NULL DEFAULT '{}';
