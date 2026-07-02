-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 19: Traducciones por servicio (EN/ES/PT)
-- El micrositio soporta EN/ES/PT, pero title/description de company_services
-- era texto libre en un solo idioma (lo que el operador escribió). Se agrega
-- una columna i18n para overrides opcionales por idioma, mismo patrón que
-- companies.settings.site.i18n (tagline/about): español sigue viviendo en las
-- columnas title/description de siempre; inglés y portugués son overrides.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.company_services ADD COLUMN IF NOT EXISTS i18n JSONB;
-- Forma esperada: { "en": {"title": "...", "description": "..."}, "pt": {...} }
