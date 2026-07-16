-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 53: Amplía el audit trail de reservas — atribución real de "quién".
--
-- Por qué NO se arregla el trigger genérico de audit_logs: casi todas las
-- escrituras de reservas pasan por createAdminClient() (service role), donde
-- auth.uid() es NULL dentro de Postgres — confirmado en producción, los
-- audit_logs de bookings tienen user_id NULL. Arreglar eso exigiría reescribir
-- cómo cada server action ejecuta sus mutaciones (fuera de alcance razonable).
--
-- En su lugar se amplía booking_events, que YA usa un patrón confiable: el
-- actor_id se pasa explícito desde la propia server action (que sí conoce a
-- `user.id` vía requireRole), igual que ya hace 'driver_reassigned'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN created_by    UUID REFERENCES public.user_profiles(id),
  ADD COLUMN dispatched_by UUID REFERENCES public.user_profiles(id);

COMMENT ON COLUMN public.bookings.created_by IS
  'Staff interno que creó la reserva desde /admin/bookings/new. NULL si la creó el pasajero desde el micrositio público.';
COMMENT ON COLUMN public.bookings.dispatched_by IS
  'Staff interno que asignó manualmente al conductor. NULL si fue auto-asignación del sistema.';

-- Ampliar tipos de evento: creación, primera asignación (distinta de
-- reasignación) y pago registrado — además de los 4 existentes.
ALTER TABLE public.booking_events DROP CONSTRAINT booking_events_type_check;
ALTER TABLE public.booking_events ADD CONSTRAINT booking_events_type_check CHECK (type IN (
  'driver_rejected', 'driver_incident', 'customer_rejected', 'driver_reassigned',
  'created', 'driver_assigned', 'payment_recorded'
));
