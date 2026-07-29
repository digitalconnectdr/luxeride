-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 80: unificar el Place ID de Google en un solo lugar.
--
-- La migración 78 agregó la columna companies.google_place_id para el botón
-- "Escríbenos una reseña" de /review/[id]. Pero ya existía, desde antes, un
-- campo separado en Configuración > Portada que guardaba el mismo dato (el
-- Place ID del negocio) dentro de companies.settings->'site'->>'googlePlaceId',
-- usado para traer las reseñas reales al carrusel del micrositio.
--
-- Resultado: el mismo dato en dos lugares de la misma pestaña, con dos
-- formularios y dos acciones de servidor distintas — justo lo que reportó el
-- usuario. Se consolida en la columna (más correcta que un valor suelto
-- dentro de un JSON) y se retira el campo/input duplicado del código.
--
-- Este backfill copia el valor viejo a la columna SOLO cuando la columna aún
-- está vacía, para no pisar un Place ID que el operador ya haya guardado en
-- el campo nuevo. No se borra el valor viejo de settings (queda inerte, sin
-- lectores en el código después de este cambio).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.companies
SET google_place_id = (settings -> 'site' ->> 'googlePlaceId')
WHERE google_place_id IS NULL
  AND (settings -> 'site' ->> 'googlePlaceId') IS NOT NULL
  AND (settings -> 'site' ->> 'googlePlaceId') <> '';
