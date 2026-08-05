-- Modelo "Por hora": millaje incluido en el mínimo de horas.
-- Sin esto, un viaje de 2h de 40 millas y uno de 2h de 200 millas cobran
-- exactamente lo mismo (el motor solo mira horas, nunca distancia). Con
-- included_miles configurado, el excedente sobre esa distancia se cobra con
-- la Tarifa por milla/km ya existente en la misma regla — no se agrega
-- ninguna tarifa nueva, solo el tope de millaje incluido.
-- NULL = sin tope (comportamiento anterior, sin cambios para reglas ya
-- configuradas).

ALTER TABLE public.pricing_rules
  ADD COLUMN included_miles NUMERIC(8,2);

COMMENT ON COLUMN public.pricing_rules.included_miles IS
  'Millaje incluido en el modelo "Por hora" junto con minimum_hours. Si distance_miles excede este valor, el excedente se cobra con per_mile_rate (o per_km_rate convertido). NULL = sin tope.';
