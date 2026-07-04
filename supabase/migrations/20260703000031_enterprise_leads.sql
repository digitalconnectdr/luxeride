-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 31: Leads del plan Enterprise (venta consultiva, sin checkout).
-- El operador ve una tarjeta "Enterprise" en Configuración → Suscripción con
-- un botón "Solicitar" (no un link de pago) que abre un formulario; eso
-- genera un lead que el super-admin gestiona desde /super-admin/enterprise-leads.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE enterprise_lead_status AS ENUM ('new', 'contacted', 'converted', 'rejected');

CREATE TABLE public.enterprise_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  requested_by   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  company_name   TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  fleet_size     TEXT,
  message        TEXT,
  status         enterprise_lead_status NOT NULL DEFAULT 'new',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enterprise_leads_status ON public.enterprise_leads(status, created_at);
CREATE INDEX idx_enterprise_leads_company ON public.enterprise_leads(company_id);

CREATE TRIGGER enterprise_leads_updated_at
  BEFORE UPDATE ON public.enterprise_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: solo super_admin gestiona/lee (no hay policy de INSERT para el
-- operador — el lead siempre se crea vía Server Action con service role).
ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manages_enterprise_leads"
  ON public.enterprise_leads FOR ALL
  USING (public.auth_has_role('super_admin'));
