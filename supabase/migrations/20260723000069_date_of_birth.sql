-- Fecha de nacimiento del pasajero — se pedirá al registrarse en la app
-- móvil (campo requerido ahí) y opcionalmente al crear un cliente manual
-- desde /admin/team. Uso futuro: mensajes de felicitación de cumpleaños
-- (retención) y, más adelante, métricas de usuarios nuevos por fecha de
-- registro ya cubiertas por created_at/idx_user_profiles_company_role_created
-- (migración 68) — este campo es solo el dato de cumpleaños en sí.
ALTER TABLE public.user_profiles
  ADD COLUMN date_of_birth DATE;
