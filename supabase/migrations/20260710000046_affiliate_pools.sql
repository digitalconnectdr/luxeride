-- Migration 46: Seccion G, Fases 3-5 - Pools, bidding, auto-farm.
-- Relaja la restriccion "un solo afiliado activo por reserva" (migracion 39)
-- para permitir pools: enviar la misma reserva a VARIOS afiliados a la vez,
-- el primero que acepta gana, los demas pasan a 'lost' automaticamente en
-- codigo (respondToAffiliateTripAction / resolveCounterOfferAction). Solo se
-- sigue exigiendo UN solo trip OPERATIVO (aceptado en adelante) por reserva -
-- multiples solicitudes 'requested'/'countered' pueden coexistir mientras se
-- espera respuesta de cada afiliado del pool.

DROP INDEX IF EXISTS public.idx_affiliate_trips_one_active_per_booking;

CREATE UNIQUE INDEX idx_affiliate_trips_one_operating_per_booking
  ON public.affiliate_trips(booking_id)
  WHERE status IN ('accepted', 'en_route', 'arrived', 'in_progress');

-- Nuevo estado 'lost': el afiliado no llego a responder o seguia pendiente
-- cuando otro miembro del mismo pool acepto primero.
ALTER TABLE public.affiliate_trips DROP CONSTRAINT affiliate_trips_status_check;
ALTER TABLE public.affiliate_trips ADD CONSTRAINT affiliate_trips_status_check
  CHECK (status IN (
    'requested', 'accepted', 'rejected', 'countered', 'expired', 'cancelled', 'lost',
    'en_route', 'arrived', 'in_progress', 'completed'
  ));
