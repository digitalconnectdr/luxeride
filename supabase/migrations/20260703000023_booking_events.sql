-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 23: Dispatch avanzado — bitácora de eventos del viaje.
-- En vez de agregar estados nuevos a booking_status (rejected_by_driver,
-- rejected_by_customer, driver_incident — invasivo, ese enum se referencia en
-- ~15 archivos), se registran como EVENTOS en su propia tabla mientras la
-- reserva vuelve a un estado ya existente (rechazo del conductor → 'pending';
-- rechazo del cliente → 'cancelled'). Misma trazabilidad completa, mucho
-- menos riesgo de romper el resto del sistema.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.booking_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
    'driver_rejected', 'driver_incident', 'customer_rejected', 'driver_reassigned'
  )),
  actor      TEXT NOT NULL CHECK (actor IN ('driver', 'customer', 'dispatcher', 'system')),
  actor_id   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reason     TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_events_booking ON public.booking_events(booking_id, created_at DESC);
CREATE INDEX idx_booking_events_company ON public.booking_events(company_id, created_at DESC);

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

-- Staff de la empresa (supervisión) lee todos los eventos.
CREATE POLICY "company_staff_read_booking_events"
  ON public.booking_events FOR SELECT
  USING (
    company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

-- El conductor registra eventos de SUS propios viajes (rechazo, incidente).
CREATE POLICY "driver_insert_own_booking_events"
  ON public.booking_events FOR INSERT
  WITH CHECK (
    actor = 'driver' AND
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.driver_id = auth.uid())
  );

-- El pasajero (sin login) y el dispatcher escriben vía server actions con
-- service-role — igual que trip_messages/trip_reports.

ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_events;

-- ─────────────────────────────────────────────

-- Notificaciones nuevas: alerta de incidente al operador (email) y aviso de
-- reasignación al conductor que pierde el viaje (SMS). Ambas sin plantilla
-- por empresa todavía — usan el default del sistema (company_id NULL), igual
-- que el resto de las plantillas semilla.
INSERT INTO public.notification_templates (company_id, channel, type, subject, body, variables) VALUES
  (NULL, 'email', 'driver_incident_alert',
   'Incidente reportado — viaje {{booking_number}}',
   'El conductor {{driver_name}} reportó un incidente en el viaje {{booking_number}} ({{category}}): {{reason}}. Pasajero: {{passenger_name}}. Revísalo en el dispatch board.',
   ARRAY['booking_number', 'driver_name', 'category', 'reason', 'passenger_name']),
  (NULL, 'sms', 'driver_unassigned',
   'LuxeRide: ya no estás asignado al viaje {{booking_number}}, fue reasignado a otro conductor.',
   'LuxeRide: ya no estás asignado al viaje {{booking_number}}, fue reasignado a otro conductor.',
   ARRAY['booking_number']);
