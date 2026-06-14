-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 17: Microsite del operador (white-label)
-- Cada empresa tiene una micropágina pública (/<slug>) con su marca:
-- slogan, imagen hero, descripción y una lista de servicios configurables.
-- ─────────────────────────────────────────────────────────────────────────────

-- Campos de portada en companies (logo_url y primary_color ya existen)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tagline        TEXT;  -- slogan
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hero_image_url TEXT;  -- imagen de portada
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS about          TEXT;  -- descripción / sobre nosotros

-- Servicios que ofrece cada operador (configurables desde el dashboard)
CREATE TABLE public.company_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,            -- emoji o nombre de ícono (ej. "✈️", "plane")
  image_url   TEXT,            -- imagen opcional del servicio
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_services_company ON public.company_services(company_id);
CREATE INDEX idx_company_services_active  ON public.company_services(company_id, is_active);

CREATE TRIGGER company_services_updated_at
  BEFORE UPDATE ON public.company_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;

-- Lectura pública de servicios activos (para el microsite público)
CREATE POLICY "company_services_public_read"
  ON public.company_services FOR SELECT
  USING (is_active = TRUE);

-- Gestión solo por owner/admin de la empresa
CREATE POLICY "admins_manage_company_services"
  ON public.company_services FOR ALL
  USING (
    company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin')
  );
