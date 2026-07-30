-- ── Atribución de marketing (UTM/gclid) por reserva ─────────────────────────
-- Captura de "primer toque" hecha en el cliente (booking-wizard.tsx) y
-- persistida al crear la reserva — ver app/actions/bookings.ts,
-- createPublicBookingAction. Usada para medir conversiones de Google Ads
-- por operador (cada operador mide sus propias campañas con su propio GA4
-- Measurement ID, guardado en companies.settings.tracking.ga_measurement_id).

ALTER TABLE public.bookings ADD COLUMN attribution JSONB DEFAULT '{}';
