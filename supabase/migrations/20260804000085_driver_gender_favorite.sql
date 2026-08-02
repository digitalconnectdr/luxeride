-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 85: preferencia de género del conductor + conductor favorito.
--
-- Inspirado en Empower (driveempower.com, rideshare "propiedad del
-- conductor"): sus dos features de pasajero con mayor valor real, no su
-- modelo de negocio (0% comisión / conductor gig) que no aplica a LuxeRide
-- (software B2B para flotas ya establecidas con choferes empleados).
--
--   · "Same gender drivers" — el pasajero puede limitar sus viajes a un
--     conductor de un género específico. Filtro DURO en auto-asignación: si
--     nadie califica, la reserva queda pendiente para asignación manual (el
--     mismo comportamiento que ya existe hoy cuando ningún candidato califica
--     por tipo de vehículo) — nunca se asigna en silencio a alguien que no
--     cumple, porque el punto del feature es la confianza/seguridad del
--     pasajero.
--   · "Add favorite drivers" — el pasajero puede pedir de nuevo al mismo
--     chofer. A diferencia del género, esto es un intento best-effort: si el
--     favorito no está disponible, la reserva sigue el flujo normal de
--     auto-asignación en vez de quedar pendiente (pedir "otra vez Juan" no
--     debería bloquear el viaje si Juan libra ese día).
-- ─────────────────────────────────────────────────────────────────────────────

-- 'female' | 'male' | NULL (sin especificar). El operador lo declara desde
-- /admin/drivers/[id] — no es autoservicio del conductor, mismo criterio que
-- el resto del perfil de compliance/flota, que hoy administra el operador.
ALTER TABLE public.drivers
  ADD COLUMN gender TEXT CHECK (gender IN ('female', 'male'));

ALTER TABLE public.passenger_preferences
  -- 'no_preference' | 'female' | 'male'
  ADD COLUMN preferred_driver_gender TEXT NOT NULL DEFAULT 'no_preference'
    CHECK (preferred_driver_gender IN ('no_preference', 'female', 'male')),
  -- Un solo favorito a la vez (no una lista) — mantiene el flujo simple: se
  -- marca desde un viaje ya completado, se reemplaza si se marca otro.
  ADD COLUMN favorite_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- No hace falta tocar bookings.passenger_preferences (JSONB) — ya copia el
-- objeto de preferencias completo al reservar (migración 76), así que ambos
-- campos nuevos quedan incluidos automáticamente en la copia congelada.
