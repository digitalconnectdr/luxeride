-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 21: Calificación bidireccional (conductor→pasajero) + promedio real
-- de drivers.rating + chat en tiempo real (Realtime en vez de solo polling).
-- ─────────────────────────────────────────────────────────────────────────────

-- El pasajero ya calificaba al conductor (bookings.rating/rating_comment/rated_at,
-- migración 07). Espejo en la otra dirección: el conductor califica al pasajero
-- (uso interno del operador, nunca se expone al pasajero).
ALTER TABLE public.bookings
  ADD COLUMN driver_rating         INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
  ADD COLUMN driver_rating_comment TEXT,
  ADD COLUMN driver_rated_at       TIMESTAMPTZ;

-- drivers.rating existe desde la migración 04 pero nunca se actualizaba (quedaba
-- fijo en el DEFAULT 5.00). Este trigger lo recalcula como el promedio real de
-- las calificaciones del pasajero cada vez que se registra o cambia una.
CREATE OR REPLACE FUNCTION public.recompute_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 2) FROM public.bookings
       WHERE driver_id = NEW.driver_id AND rating IS NOT NULL),
      5.00
    )
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER bookings_recompute_driver_rating
  AFTER UPDATE OF rating ON public.bookings
  FOR EACH ROW
  WHEN (OLD.rating IS DISTINCT FROM NEW.rating)
  EXECUTE FUNCTION public.recompute_driver_rating();

-- ─────────────────────────────────────────────

-- Chat cliente↔conductor (migración 18) hacía polling cada 8s. Con Realtime el
-- pasajero/conductor ven los mensajes (y los acuses de lectura vía read_at, que
-- ya existía sin usarse) sin esperar al siguiente ciclo de polling.
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages;
