-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 77: feriados por empresa.
--
-- `pricing_rules.holiday_surcharge_pct` existe desde el inicio, se guarda, se
-- pasa por toda la UI... y NUNCA se aplicó. Era código muerto: el motor de
-- precios no tenía forma de saber qué día es feriado, así que el porcentaje
-- que el operador configuraba no hacía nada. Esta tabla lo resuelve.
--
-- Por empresa y no global: los feriados de República Dominicana no son los de
-- Estados Unidos, y aunque lo fueran, un operador puede querer cobrar recargo
-- un día que legalmente no es feriado (un fin de semana de convención, por
-- ejemplo). Que cada empresa declare los suyos es más simple y más flexible
-- que mantener un catálogo por país.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.company_holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- DATE puro, sin hora: un feriado cubre el día completo en la zona horaria
  -- de la empresa (companies.timezone), igual que el recargo nocturno usa esa
  -- misma zona para decidir si son las 22h.
  holiday_date DATE NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- El mismo día no puede declararse dos veces para la misma empresa.
  UNIQUE (company_id, holiday_date)
);

-- El motor de precios pregunta "¿esta fecha es feriado para esta empresa?" en
-- CADA cotización, así que el índice va por ese par exacto.
CREATE INDEX idx_company_holidays_lookup
  ON public.company_holidays(company_id, holiday_date);

ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro del staff de la empresa (la cotización pública
-- corre con service-role, así que no necesita política propia).
CREATE POLICY "staff_read_company_holidays"
  ON public.company_holidays FOR SELECT
  USING (company_id = public.auth_company_id());

-- Escritura: solo quien administra precios.
CREATE POLICY "admins_manage_company_holidays"
  ON public.company_holidays FOR ALL
  USING (
    company_id = public.auth_company_id()
    AND public.auth_has_role('company_owner', 'company_admin')
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_has_role('company_owner', 'company_admin')
  );
