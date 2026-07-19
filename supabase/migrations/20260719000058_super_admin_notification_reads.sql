-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 58: estado de lectura de la campana de notificaciones del
-- super-admin -- hasta ahora el badge rojo se calculaba solo de
-- feature_requests.status='submitted' (estado de negocio), sin importar si
-- el super-admin ya había abierto el panel. Esto hacía que la campana
-- pareciera "notificación nueva" indefinidamente aunque ya se hubiera visto.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.super_admin_notification_reads (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.super_admin_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage_own_notification_reads"
  ON public.super_admin_notification_reads FOR ALL
  USING (user_id = auth.uid() AND public.auth_has_role('super_admin'))
  WITH CHECK (user_id = auth.uid() AND public.auth_has_role('super_admin'));
