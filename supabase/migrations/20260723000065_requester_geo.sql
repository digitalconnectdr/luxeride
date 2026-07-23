-- Ciudad/país desde donde se CREA la solicitud de reserva (no confundir con
-- pickup_city/dropoff_city, que son las ciudades del viaje en sí). Se
-- resuelve en el momento de la creación vía geolocation() de @vercel/functions
-- (headers x-vercel-ip-city/x-vercel-ip-country del edge de Vercel, sin
-- llamada a ninguna API externa ni permiso del usuario) — ver
-- createPublicBookingAction en apps/web/app/actions/bookings.ts. Sirve para
-- que el operador sepa en qué ciudades vive su clientela real (para pautar
-- Google Ads/Meta), que puede ser distinta de las ciudades de origen/destino
-- del viaje (ej. alguien en Santo Domingo reservando un viaje para un
-- familiar en Nueva York). No se puede rellenar retroactivo — nunca se
-- capturó la IP de reservas anteriores a esta migración, quedan NULL.
ALTER TABLE public.bookings
  ADD COLUMN requester_city TEXT,
  ADD COLUMN requester_country TEXT;
