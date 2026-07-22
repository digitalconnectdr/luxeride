-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 61: 2 hallazgos críticos de la auditoría de RLS (2026-07-21)
--
-- 1. live_tracking_usage_by_booking (migración 26) nunca tuvo RLS habilitado
--    — la única entre las 59 tablas del proyecto sin ALTER TABLE ... ENABLE
--    ROW LEVEL SECURITY. Hoy no es explotable (solo se lee/escribe vía
--    service-role), pero queda expuesta sin filtro si algún día se agrega una
--    query client-side. Mismo alcance que su tabla hermana
--    live_tracking_usage (solo super-admin, ver migración 20).
--
-- 2. Las 3 funciones que usan TODAS las políticas RLS del proyecto
--    (auth_company_id, auth_role, auth_has_role) + audit_trigger() son
--    SECURITY DEFINER sin `search_path` fijo — el patrón clásico de
--    escalación de privilegios en Postgres (Supabase Security Advisor lo
--    marca como "Function Search Path Mutable"). handle_new_user() tenía
--    el mismo defecto y ya se corrigió (migración 16, tras un bug real de
--    producción) — nunca se aplicó retroactivamente a estas 4. CREATE OR
--    REPLACE preserva el cuerpo exacto de cada función, solo agrega
--    `SET search_path = public`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. RLS en live_tracking_usage_by_booking ──────────────────────────────────
ALTER TABLE public.live_tracking_usage_by_booking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_live_tracking_usage_by_booking"
  ON public.live_tracking_usage_by_booking FOR SELECT
  USING (public.auth_has_role('super_admin'));

-- ── 2. search_path fijo en las funciones SECURITY DEFINER ─────────────────────

CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS user_role AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.auth_has_role(VARIADIC roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = ANY(roles)
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    company_id,
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.company_id
      ELSE NEW.company_id
    END,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
