-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 26: Consumo de mapa en vivo por VIAJE (además del total por
-- empresa que ya existía en live_tracking_usage). Permite, en el detalle de
-- una empresa, ver qué conductor/pasajero generó más carga de mapas en un
-- viaje puntual — útil para investigar feedback o uso anómalo.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.live_tracking_usage_by_booking (
  booking_id    UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year_month    TEXT NOT NULL,
  refresh_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booking_id, year_month)
);

CREATE INDEX idx_live_tracking_usage_by_booking_company ON public.live_tracking_usage_by_booking(company_id, year_month);
