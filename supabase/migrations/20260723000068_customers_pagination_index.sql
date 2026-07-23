-- Índice compuesto para paginar/ordenar la nueva pestaña "Pasajeros" de
-- /admin/team (WHERE company_id = ? AND role = 'customer' ORDER BY created_at
-- DESC) sin tener que escanear+ordenar en memoria a medida que crece la base
-- de pasajeros. idx_user_profiles_company_role (migración 03) ya cubre el
-- filtro pero no el orden; este índice cubre ambos en un solo scan.
CREATE INDEX idx_user_profiles_company_role_created
  ON public.user_profiles(company_id, role, created_at DESC);
