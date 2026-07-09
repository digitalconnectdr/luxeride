-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 42: soporte para la app nativa del conductor (Fase 2B)
-- - Fotos de licencia/seguro subidas desde la app (bucket "documents" ya
--   existe con policies de auto-uploads por carpeta propia, migración 12).
-- - Ruta de la firma del pasajero al completar el viaje (capturada en la app).
-- Ambas columnas nullable, sin backfill necesario.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.drivers
  ADD COLUMN license_photo_url TEXT,
  ADD COLUMN insurance_photo_url TEXT;

ALTER TABLE public.bookings
  ADD COLUMN passenger_signature_path TEXT;
