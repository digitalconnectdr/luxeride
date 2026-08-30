-- ── Geografía de visitantes del landing (mapa en /super-admin/geography) ──
-- Solo se guarda ciudad/región/país/coordenadas derivadas de la IP - la IP
-- en sí NUNCA se persiste. Insertado por app/api/track/visit/route.ts
-- (service-role), leído por el panel de super-admin (misma vía). RLS
-- habilitado sin policies: acceso solo por service-role, igual que otras
-- tablas internas de la plataforma.

CREATE TABLE public.landing_page_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  path          TEXT,
  city          TEXT,
  region        TEXT,
  country       TEXT,
  country_code  TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION
);

CREATE INDEX landing_page_visits_visited_at_idx ON public.landing_page_visits (visited_at DESC);
CREATE INDEX landing_page_visits_city_idx ON public.landing_page_visits (city);

ALTER TABLE public.landing_page_visits ENABLE ROW LEVEL SECURITY;
