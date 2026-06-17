-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 18: Chat cliente↔conductor + reportes del conductor
-- - trip_messages: mensajería ligera por reserva (el pasajero escribe desde el
--   link público de seguimiento; el conductor desde su panel). Sirve para avisar
--   retrasos de vuelo, coordinar el punto de encuentro, etc.
-- - trip_reports: el pasajero puede reportar al conductor (ej. marcó "llegué"
--   sin haber llegado). El operador los revisa y resuelve.
-- El acceso del pasajero (sin login) se hace SIEMPRE vía server actions con
-- service-role validando el UUID de la reserva como capability URL.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Mensajes ──────────────────────────────────────────────────────────────────
CREATE TABLE public.trip_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('client', 'driver')),
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trip_messages_booking ON public.trip_messages(booking_id, created_at);

ALTER TABLE public.trip_messages ENABLE ROW LEVEL SECURITY;

-- El conductor asignado puede leer/escribir los mensajes de SUS viajes.
CREATE POLICY "driver_reads_trip_messages"
  ON public.trip_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = trip_messages.booking_id AND b.driver_id = auth.uid()
  ));

CREATE POLICY "driver_writes_trip_messages"
  ON public.trip_messages FOR INSERT
  WITH CHECK (
    sender = 'driver' AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = trip_messages.booking_id AND b.driver_id = auth.uid()
    )
  );

-- Admin/owner de la empresa puede leer los mensajes (supervisión/soporte).
CREATE POLICY "admins_read_trip_messages"
  ON public.trip_messages FOR SELECT
  USING (
    company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

-- ── Reportes ──────────────────────────────────────────────────────────────────
CREATE TABLE public.trip_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  category     TEXT NOT NULL DEFAULT 'other',  -- false_arrival | no_contact | unsafe | other
  reason       TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trip_reports_company ON public.trip_reports(company_id, created_at);
CREATE INDEX idx_trip_reports_booking ON public.trip_reports(booking_id);

ALTER TABLE public.trip_reports ENABLE ROW LEVEL SECURITY;

-- Admin/owner/dispatcher de la empresa gestiona los reportes.
CREATE POLICY "admins_manage_trip_reports"
  ON public.trip_reports FOR ALL
  USING (
    company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );
