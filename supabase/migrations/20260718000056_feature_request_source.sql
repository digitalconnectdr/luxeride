-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 56: origen de la solicitud (feature_requests.source) -- el botón
-- de "recomendar función / reportar problema" ahora también vive en el
-- portal del conductor y en la página pública de tracking del pasajero, no
-- solo en el admin. Esta columna deja identificar en el panel de super-admin
-- por cuál de los tres canales llegó cada solicitud.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE feature_request_source AS ENUM ('admin', 'driver', 'customer');

ALTER TABLE public.feature_requests
  ADD COLUMN source feature_request_source NOT NULL DEFAULT 'admin';
