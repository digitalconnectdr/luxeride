-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 22: Ruta real (polyline codificado de Google) en vez de línea recta
-- entre pickup y destino. El mapa (estático y en vivo) hoy dibuja una línea
-- recta ("como el cuervo vuela") entre los dos puntos — no sigue las calles.
-- Se calcula gratis: la Routes API ya se llama para distancia/duración, solo
-- se pide un campo más en el mismo request (routes.polyline.encodedPolyline).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.price_quotes ADD COLUMN route_polyline TEXT;
ALTER TABLE public.bookings     ADD COLUMN route_polyline TEXT;
