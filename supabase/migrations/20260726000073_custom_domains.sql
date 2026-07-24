-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 73: dominio personalizado por empresa (add-on "Dominio personalizado")
-- Dos caminos, mismo resultado final: companies.custom_domain verificado.
-- (a) BYOD — el operador ya tiene un dominio, lo agrega él mismo desde
--     /admin/domain, apunta su DNS (CNAME) y el sistema verifica contra la
--     API de Vercel (ver lib/vercel/domains.ts).
-- (b) El operador no tiene dominio y pide que se lo consigamos — deja una
--     solicitud en domain_requests (nombre sugerido), el super-admin la
--     compra MANUALMENTE fuera del sistema (no hay integración de compra de
--     dominios, es dinero real) y entra el dominio real comprado, lo que
--     dispara el MISMO flujo de verificación que (a).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN custom_domain TEXT UNIQUE,
  ADD COLUMN custom_domain_status TEXT CHECK (custom_domain_status IN ('pending_verification', 'verified', 'failed')),
  ADD COLUMN custom_domain_added_at TIMESTAMPTZ;

CREATE TYPE domain_request_status AS ENUM ('pending', 'purchased', 'rejected');

CREATE TABLE public.domain_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  requested_name   TEXT NOT NULL,
  notes            TEXT,
  status           domain_request_status NOT NULL DEFAULT 'pending',
  resolved_domain  TEXT,
  resolved_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domain_requests_status ON public.domain_requests(status, created_at);
CREATE INDEX idx_domain_requests_company ON public.domain_requests(company_id);

-- RLS: mismo patrón que enterprise_leads — nadie inserta/lee directo desde
-- el cliente (siempre vía Server Action con service role); solo super_admin
-- puede leer/gestionar si en algún momento se consulta directo por RLS.
ALTER TABLE public.domain_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manages_domain_requests"
  ON public.domain_requests FOR ALL
  USING (public.auth_has_role('super_admin'));
