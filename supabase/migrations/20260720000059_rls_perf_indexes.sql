-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 59: índices faltantes en columnas usadas por políticas RLS
-- (auditoría 2026-07-20) — 4 tablas donde la columna que filtra la política
-- de RLS (normalmente company_id vía auth_company_id()) no tenía índice
-- propio, o solo tenía índices simples en vez de un compuesto para el
-- patrón real de consulta. Las 4 son tablas de alto volumen de escritura
-- (GPS, mensajes, auditoría, notificaciones) — sin esto, a medida que crezca
-- el número de empresas y el tráfico, esas consultas empiezan a degradar a
-- seq scan. Solo CREATE INDEX — no toca datos, RLS ni código de la app.
-- Sin CONCURRENTLY: el editor SQL de Supabase envuelve el script en una
-- transacción implícita, donde CONCURRENTLY no es válido (25001). Con el
-- volumen actual de producción el bloqueo breve de escritura no es un
-- problema real.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_trip_locations_company
  ON public.trip_locations(company_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_messages_company
  ON public.trip_messages(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created
  ON public.audit_logs(company_id, created_at DESC)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_company_user
  ON public.notifications(company_id, user_id, created_at DESC);
