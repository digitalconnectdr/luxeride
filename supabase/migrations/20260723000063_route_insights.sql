-- ── Reporte de rutas frecuentes — add-on AI Growth Assistant ───────────────
-- Ciudad/país de origen y destino por reserva, derivados con reverse
-- geocoding (ver apps/web/lib/maps/reverse-geocode.ts) en background al
-- crear la reserva, y con backfill diario (cron geocode-backfill) para
-- reservas históricas. Sin cambios de RLS — las políticas de bookings ya
-- son por company_id para el staff que consulta este reporte.
--
-- booking_source: por qué canal se creó la reserva (web guest, app nativa
-- de pasajero, o staff/dispatcher) — dato pedido explícitamente por el
-- usuario para saber en qué canal se usa más el sistema, junto al insight
-- geográfico.

ALTER TABLE public.bookings
  ADD COLUMN pickup_city TEXT,
  ADD COLUMN pickup_country TEXT,
  ADD COLUMN dropoff_city TEXT,
  ADD COLUMN dropoff_country TEXT,
  ADD COLUMN booking_source TEXT NOT NULL DEFAULT 'web'
    CHECK (booking_source IN ('web', 'mobile_app', 'staff'));

CREATE INDEX idx_bookings_pickup_city ON public.bookings(company_id, pickup_city)
  WHERE pickup_city IS NOT NULL;

CREATE INDEX idx_bookings_dropoff_city ON public.bookings(company_id, dropoff_city)
  WHERE dropoff_city IS NOT NULL;

CREATE INDEX idx_bookings_source ON public.bookings(company_id, booking_source);
