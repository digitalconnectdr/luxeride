-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 24: Chat Dispatch ↔ Conductor (canal general, no atado a una reserva)
-- A diferencia de trip_messages (por reserva, pasajero↔conductor), este canal
-- permite a Dispatch contactar a un conductor "en servicio" aunque no tenga un
-- viaje activo en este momento (ej. avisar un cambio, preguntar disponibilidad).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.driver_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('dispatch', 'driver')),
  sender_name TEXT,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_messages_driver ON public.driver_messages(driver_id, created_at);
CREATE INDEX idx_driver_messages_company ON public.driver_messages(company_id, created_at);

ALTER TABLE public.driver_messages ENABLE ROW LEVEL SECURITY;

-- El conductor lee/escribe su propio canal.
CREATE POLICY "driver_reads_own_messages"
  ON public.driver_messages FOR SELECT
  USING (driver_id = auth.uid());

CREATE POLICY "driver_writes_own_messages"
  ON public.driver_messages FOR INSERT
  WITH CHECK (sender = 'driver' AND driver_id = auth.uid());

-- Admin/owner/dispatcher de la empresa leen/escriben los canales de sus conductores.
CREATE POLICY "staff_reads_driver_messages"
  ON public.driver_messages FOR SELECT
  USING (
    company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

CREATE POLICY "staff_writes_driver_messages"
  ON public.driver_messages FOR INSERT
  WITH CHECK (
    sender = 'dispatch' AND
    company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_messages;
