-- Direcciones guardadas del pasajero (app móvil) — "Casa", "Trabajo", etc.
-- para reservar más rápido sin re-escribir la dirección cada vez. RLS
-- scopeada al propio usuario, sin excepción de staff (es un dato personal
-- del pasajero, no algo que el operador necesite ver/gestionar).
CREATE TABLE public.passenger_saved_addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  address     TEXT NOT NULL,
  lat         NUMERIC(10, 7) NOT NULL,
  lng         NUMERIC(10, 7) NOT NULL,
  place_id    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_passenger_saved_addresses_customer ON public.passenger_saved_addresses(customer_id);

ALTER TABLE public.passenger_saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passenger_manage_own_saved_addresses"
  ON public.passenger_saved_addresses FOR ALL
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
