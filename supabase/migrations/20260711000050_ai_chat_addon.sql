-- Migration 50: asistente de IA por micrositio (add-on de pago, docs/PENDING.md).
-- Reusa la tabla generica company_addons (addon_key='ai_chat_basic'|'ai_chat_plus')
-- para el estado de activacion - NO requiere columnas nuevas ahi. A proposito
-- NO se agregan estos dos keys a lib/billing/addons.ts (ADDON_KEYS), porque ese
-- modulo incluye automaticamente cualquier addon gratis en Elite/Enterprise, y
-- este addon si tiene costo variable real (tokens de OpenAI por conversacion),
-- asi que su activacion vive en su propio modulo (lib/billing/ai-chat-addon.ts)
-- sin ese comportamiento de "gratis por plan".
--
-- El conteo de conversaciones del mes (para cuota/excedente) se calcula al
-- vuelo con COUNT(*) sobre started_at, mismo espiritu que payroll_payments
-- (sin columna contadora que mantener sincronizada).

CREATE TABLE public.ai_chat_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  session_token   TEXT NOT NULL UNIQUE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_conversations_company_period ON public.ai_chat_conversations(company_id, started_at);

ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_select_ai_chat_conversations"
  ON public.ai_chat_conversations FOR SELECT
  USING (company_id = public.auth_company_id());

-- ── Mensajes de cada conversacion (para auditoria del operador) ─────────────
CREATE TABLE public.ai_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_messages_conversation ON public.ai_chat_messages(conversation_id, created_at);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_select_ai_chat_messages"
  ON public.ai_chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.ai_chat_conversations WHERE company_id = public.auth_company_id()
    )
  );
