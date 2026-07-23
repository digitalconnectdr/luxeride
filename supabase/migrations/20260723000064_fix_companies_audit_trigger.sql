-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 64: fix crítico — audit_trigger() roto en la tabla companies
--
-- audit_trigger() (migración 11, retocada en 61) referencia OLD.company_id /
-- NEW.company_id — correcto para bookings/payments/refunds/user_profiles
-- (todas tienen una FK company_id), pero companies NO tiene esa columna,
-- solo `id`. Cualquier UPDATE sobre companies (cambio de status/plan desde
-- super-admin, activación/renovación de suscripción vía Whop en
-- lib/billing/subscriptions.ts, suspensión por webhook) fallaba con:
--   record "old"/"new" has no field "company_id"
-- Se descubrió hoy al intentar reactivar una empresa suspendida desde
-- /super-admin/companies — el error quedaba oculto porque el formulario
-- (status-forms.tsx) no revisaba el resultado del server action (ya
-- corregido por separado). Esto probablemente también bloqueó en silencio
-- activaciones reales de suscripciones pagadas por Whop.
--
-- Fix: función de auditoría dedicada para companies, usando `id` en vez de
-- `company_id` (una empresa se audita bajo su propio id, tiene sentido para
-- filtrar su historial). El trigger audit_companies se re-apunta a esta
-- función nueva; audit_trigger() (genérico) queda intacto para las demás
-- tablas.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_companies_trigger()
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
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
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

DROP TRIGGER IF EXISTS audit_companies ON public.companies;

CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_companies_trigger();
