-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 60: centro de notificaciones del panel admin (no super-admin) —
-- concentra avisos hoy dispersos (badge de mantenimiento en Flota, banner de
-- Compliance, reporte de conductor sin superficie visual) en una sola campana,
-- con el mismo patrón de leído/no-leído que ya usa el super-admin.
--
-- Pensado para volumen: a diferencia del super-admin (una campana global que
-- puede darse el lujo de 3 queries en vivo con joins), esta campana la carga
-- CADA admin de CADA empresa en CADA navegación del panel — con muchas
-- empresas activas eso se multiplica rápido. Por eso los avisos NO se
-- calculan al vuelo (comparando fechas/joins en cada render): se insertan una
-- sola vez cuando ocurren (evento discreto) o los detecta el cron diario ya
-- existente (compliance-alerts), con dedup para no repetir el mismo aviso
-- todos los días mientras siga vigente. El layout admin solo hace UNA query
-- indexada por (company_id, created_at) — rápida sin importar cuántas
-- empresas o cuántos avisos totales acumule el sistema.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.admin_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- 'driver_report' | 'vehicle_maintenance' | 'compliance_alert'
  title         TEXT NOT NULL,
  detail        TEXT,
  href          TEXT,
  source_table  TEXT,          -- para dedup: tabla que originó el aviso (ej. 'vehicles')
  source_id     UUID,          -- para dedup: fila que lo originó (ej. el vehicle_id)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query principal de la campana: avisos de MI empresa, más recientes primero.
CREATE INDEX idx_admin_notifications_company_created
  ON public.admin_notifications(company_id, created_at DESC);

-- Dedup: "¿ya avisé sobre ESTA fuente recientemente?" antes de insertar de nuevo
-- (usado por el cron para no repetir el mismo vehículo/empresa cada día).
CREATE INDEX idx_admin_notifications_dedup
  ON public.admin_notifications(company_id, type, source_id, created_at DESC)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_staff_read_notifications"
  ON public.admin_notifications FOR SELECT
  USING (
    company_id = public.auth_company_id()
    AND public.auth_has_role('company_owner', 'company_admin', 'dispatcher', 'accounting')
  );
-- Sin política de INSERT/UPDATE/DELETE para authenticated: los avisos los
-- crea siempre el service-role (server actions y el cron), nunca el cliente.

-- ── Estado de lectura (mismo patrón que super_admin_notification_reads) ──────
CREATE TABLE public.admin_notification_reads (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_own_notification_reads"
  ON public.admin_notification_reads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
