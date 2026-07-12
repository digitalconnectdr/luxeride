-- Migration 52: AI Growth Assistant (add-on de pago, docs/PENDING.md).
-- Empaqueta 2 features chicas bajo una sola cuota mensual de "generaciones
-- de IA": (1) seguimiento de cotizaciones abandonadas redactado por IA
-- (reemplaza el texto generico del cron quote-followup existente), y (2) un
-- generador de contenido de marketing bajo demanda (posts para redes/Google
-- Business, solo texto, sin auto-publicar).
--
-- Mismo espiritu que ai_chat_addon (migracion 50): reusa company_addons
-- (addon_key='ai_growth_basic'|'ai_growth_plus') para el estado de
-- activacion, y a proposito NO se agrega a lib/billing/addons.ts (ADDON_KEYS)
-- porque ese modulo incluye gratis en Elite/Enterprise, y este addon si
-- tiene costo variable real por generacion.
--
-- El conteo de generaciones del mes se calcula al vuelo con COUNT(*) sobre
-- created_at, mismo espiritu que ai_chat_conversations/payroll_payments.

CREATE TABLE public.ai_growth_generations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('quote_followup', 'content')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_growth_generations_company_period ON public.ai_growth_generations(company_id, created_at);

ALTER TABLE public.ai_growth_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_select_ai_growth_generations"
  ON public.ai_growth_generations FOR SELECT
  USING (company_id = public.auth_company_id());
