-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 55: Solicitudes de "recomendar función nueva" y "reportar un
-- problema" -- un botón junto al ícono de Ayuda en la barra superior del
-- admin abre un formulario; el super-admin revisa todas las solicitudes en
-- /super-admin/feature-requests con un flujo de estado Enviada → Pendiente →
-- En trabajo → Solucionada. Comparten una sola tabla (campo `type`) porque
-- son la misma forma de dato -- título + descripción + quién la envió.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE feature_request_type AS ENUM ('feature', 'bug');
CREATE TYPE feature_request_status AS ENUM ('submitted', 'pending', 'in_progress', 'resolved');

CREATE TABLE public.feature_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  requested_by   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  type           feature_request_type NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  status         feature_request_status NOT NULL DEFAULT 'submitted',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_requests_status ON public.feature_requests(status, created_at);
CREATE INDEX idx_feature_requests_company ON public.feature_requests(company_id);

CREATE TRIGGER feature_requests_updated_at
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: solo super_admin gestiona/lee (no hay policy de INSERT para el
-- operador -- la solicitud siempre se crea vía Server Action con service role,
-- mismo patrón que enterprise_leads).
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manages_feature_requests"
  ON public.feature_requests FOR ALL
  USING (public.auth_has_role('super_admin'));
