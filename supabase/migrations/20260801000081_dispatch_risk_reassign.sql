-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 81: Protocolo de respaldo (Guaranteed Ride) — plantillas de aviso al
-- pasajero + pg_cron para vigilar reservas asignadas cerca del pickup.
--
-- Por qué pg_cron y no un cron de Vercel: el plan Hobby de Vercel solo permite
-- ejecutar cada cron 1 vez al día (ver app/api/cron/auto-assign/route.ts), y
-- este protocolo necesita revisar los viajes cada pocos minutos cerca de la
-- hora de recogida para que sirva de algo. pg_cron corre DENTRO de Supabase
-- (gratis, sin depender del plan de Vercel) y llama al webhook nuevo vía
-- net.http_post — mismo header Bearer + CRON_SECRET que usan los crons de
-- Vercel, solo cambia quién dispara la llamada. Primera vez que se usa
-- pg_cron/pg_net en este proyecto.
-- ─────────────────────────────────────────────────────────────────────────────

-- Plantilla de aviso al pasajero — copy tranquilizador y DISTINTO del genérico
-- "conductor asignado" (driver_assigned). El punto del Guaranteed Ride es que
-- el pasajero SEPA que hubo un respaldo automático, no que note un cambio sin
-- explicación.
INSERT INTO public.notification_templates (company_id, channel, type, subject, body, variables) VALUES
  (NULL, 'email', 'driver_reassigned_reassurance',
   'Ya te asignamos otro conductor — {{booking_number}}',
   'Por tu tranquilidad: detectamos que tu conductor original podía retrasarse y ya te asignamos otro conductor certificado de la misma flota. Tu viaje {{booking_number}} sigue en orden, sin ningún paso adicional de tu parte.',
   ARRAY['booking_number']),
  (NULL, 'sms', 'driver_reassigned_reassurance',
   NULL,
   'LuxeRide: por tu tranquilidad ya te asignamos otro conductor certificado para tu viaje {{booking_number}}. Todo sigue en orden.',
   ARRAY['booking_number']);

-- ─────────────────────────────────────────────
-- pg_cron: revisa cada 5 minutos las reservas asignadas cerca del pickup.
--
-- ANTES DE CORRER ESTE BLOQUE:
--   1. Reemplaza <APP_URL> por la URL pública real (https://getluxeride.vercel.app
--      en producción, o el dominio del entorno donde quieras activarlo).
--   2. Reemplaza <CRON_SECRET> por el valor real de la env var CRON_SECRET
--      (Vercel → Settings → Environment Variables). Sin esto la ruta responde
--      401 y el protocolo de respaldo nunca corre.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'dispatch-risk-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := '<APP_URL>/api/cron/dispatch-risk-check',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Para desactivarlo más adelante (ej. si se decide correrlo desde otro lado):
--   SELECT cron.unschedule('dispatch-risk-check');
