-- Migracion 43: foto de perfil del conductor + presencia de flota "en servicio"
-- - drivers.photo_url: foto de perfil (bucket publico "avatars" ya existe con
--   policies de auto-upload por carpeta propia, migracion 12). Se muestra al
--   pasajero en /track/[id] en vez del circulo con la inicial.
-- - driver_presence: ultima posicion conocida de un conductor MIENTRAS esta
--   disponible (is_available=true), independiente de tener un viaje activo o
--   no. Separada de trip_locations (que es por-reserva) porque el Dispatch
--   Board necesita ver TODA la flota en servicio, no solo conductores con un
--   viaje en curso.

ALTER TABLE public.drivers
  ADD COLUMN photo_url TEXT;

CREATE TABLE public.driver_presence (
  driver_id   UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_presence_company ON public.driver_presence(company_id, updated_at DESC);

ALTER TABLE public.driver_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_upsert_own_presence"
  ON public.driver_presence FOR ALL
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "staff_select_company_presence"
  ON public.driver_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND company_id = driver_presence.company_id
        AND role IN ('company_owner', 'company_admin', 'dispatcher', 'super_admin')
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_presence;
