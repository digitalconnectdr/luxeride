-- Piso de horas para el modelo de precio "Por hora" (hourly). Hoy la tarifa
-- se calcula como hourly_rate * (duracion_estimada_de_Google_Maps / 60) — un
-- servicio "por horas" real (bodas, eventos, disposicion del conductor) no
-- se cotiza por cuanto tarda Google en manejar de origen a destino, y si
-- ambas direcciones son iguales (comun en este tipo de servicio) la
-- duracion estimada es ~0 y la tarifa base sale en $0. minimum_hours pone un
-- piso: la tarifa nunca se calcula con menos de esas horas, sin importar
-- cuan corta sea la ruta estimada. No reemplaza un futuro campo de "horas
-- solicitadas" explicito — es un arreglo rapido pedido por el operador
-- mientras tanto.
ALTER TABLE public.pricing_rules
  ADD COLUMN minimum_hours NUMERIC(6,2) DEFAULT 0;
