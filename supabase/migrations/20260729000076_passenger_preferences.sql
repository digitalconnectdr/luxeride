-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 76: preferencias de viaje del pasajero.
--
-- Qué hace la competencia (julio 2026):
--   · Uber Black permite fijar temperatura de cabina, nivel de conversación
--     ("Quiet mode") y ayuda con equipaje ANTES de pedir el viaje.
--   · Blacklane ajusta música y temperatura según la preferencia del pasajero,
--     con un estándar de cabina de 20-22 °C.
-- Este es el mínimo que un servicio ejecutivo debe ofrecer para no quedarse
-- atrás. Se agregan además dos cosas que ninguno de los dos resuelve bien:
-- notas fijas para el conductor (hoy el pasajero reescribe "portón azul, no
-- tocar bocina" en CADA reserva) y vehículo preferido.
--
-- Decisión clave: las preferencias se COPIAN a la reserva al crearla, no se
-- leen en vivo desde el perfil. Si el pasajero cambia sus preferencias en
-- marzo, un viaje de enero debe seguir mostrando lo que pidió en enero — el
-- conductor y el operador necesitan saber qué se acordó, no qué prefiere hoy.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.passenger_preferences (
  customer_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'no_preference' | 'quiet' | 'chatty'
  conversation      TEXT NOT NULL DEFAULT 'no_preference'
                    CHECK (conversation IN ('no_preference', 'quiet', 'chatty')),
  -- 'no_preference' | 'cool' | 'mild' | 'warm'  (mild ≈ el 20-22 °C de Blacklane)
  temperature       TEXT NOT NULL DEFAULT 'no_preference'
                    CHECK (temperature IN ('no_preference', 'cool', 'mild', 'warm')),
  -- 'no_preference' | 'none' | 'soft' | 'driver_choice'
  music             TEXT NOT NULL DEFAULT 'no_preference'
                    CHECK (music IN ('no_preference', 'none', 'soft', 'driver_choice')),
  -- El pasajero suele viajar con equipaje y agradece ayuda para cargarlo.
  luggage_help      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Instrucciones que se repiten en todos sus viajes (portón, timbre, etc.).
  -- Se anteponen a las instrucciones puntuales de cada reserva.
  standing_notes    TEXT,
  -- Tipo de vehículo que prefiere; se preselecciona al cotizar. ON DELETE SET
  -- NULL: si el operador elimina ese tipo, la preferencia se olvida sola en vez
  -- de dejar un puntero roto.
  preferred_vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.passenger_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_manage_own_preferences"
  ON public.passenger_preferences FOR ALL
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- ── Copia congelada en la reserva ───────────────────────────────────────────
-- Sin esto las preferencias no le sirven a nadie: el conductor lee la reserva,
-- no el perfil del pasajero (y su RLS no le daría acceso a ese perfil de todos
-- modos). Guardar el objeto completo evita además una consulta extra por viaje
-- en la pantalla del conductor.
ALTER TABLE public.bookings
  ADD COLUMN passenger_preferences JSONB;

COMMENT ON COLUMN public.bookings.passenger_preferences IS
  'Copia de passenger_preferences al momento de reservar. Congelada a propósito: refleja lo que el pasajero pidió para ESTE viaje, no lo que prefiere hoy.';
