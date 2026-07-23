-- "Horas solicitadas" para el modelo de precio "Por hora": el cliente/staff
-- ahora puede indicar cuántas horas de servicio quiere (bodas, eventos,
-- disposición del conductor) en vez de que el sistema infiera la duración
-- desde la ruta estimada de Google Maps entre origen y destino. Ver
-- lib/pricing/engine.ts: si viene requested_hours, se usa esa cifra (con el
-- piso de minimum_hours igual); si no viene (reservas que no son "hourly"),
-- se mantiene el comportamiento anterior basado en la duración estimada.
ALTER TABLE public.price_quotes
  ADD COLUMN requested_hours NUMERIC(6,2);

ALTER TABLE public.bookings
  ADD COLUMN requested_hours NUMERIC(6,2);

-- El operador pidió que el mínimo de horas configurable (agregado en
-- 20260723000066) tenga un default de 1h en vez de 0 — evita el caso $0 por
-- defecto para cualquier regla "Por hora" nueva, sin dejar de ser ajustable
-- por si una empresa necesita otro valor. Las reglas "Por hora" existentes
-- quedaron en 0 por el default anterior de esa migración (nadie las había
-- configurado todavía vía la UI nueva) — se suben a 1 también, para que el
-- fix aplique de inmediato sin que el operador tenga que ir regla por regla.
ALTER TABLE public.pricing_rules
  ALTER COLUMN minimum_hours SET DEFAULT 1;

UPDATE public.pricing_rules
  SET minimum_hours = 1
  WHERE model = 'hourly' AND minimum_hours = 0;
