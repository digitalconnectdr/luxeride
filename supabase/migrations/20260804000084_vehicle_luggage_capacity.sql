-- ── Capacidad de equipaje por tipo de vehículo ──────────────────────────────
-- El pasajero declara cuánto equipaje lleva (3 categorías) al reservar; si
-- excede la capacidad configurada del vehículo elegido, se cobra
-- automáticamente reusando el fee ya existente companies.settings.fees.
-- extra_luggage_fee (ver lib/policy/engine.ts parseExtraFees) — el mismo
-- monto que hoy solo el conductor podía cobrar manualmente post-viaje.

ALTER TABLE public.vehicle_types
  ADD COLUMN luggage_carry_on_capacity    INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN luggage_checked_capacity     INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN luggage_extra_large_capacity INTEGER NOT NULL DEFAULT 0;

-- Nullable: reservas existentes nunca declararon equipaje.
ALTER TABLE public.bookings
  ADD COLUMN luggage_carry_on    INTEGER,
  ADD COLUMN luggage_checked     INTEGER,
  ADD COLUMN luggage_extra_large INTEGER;
