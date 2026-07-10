-- Migracion 44: tokens de push (Expo) para notificaciones a la app movil
-- Simplificado a proposito: NO pasa por el sistema de templates de
-- notification_templates (ese es para email/SMS al pasajero, multi-idioma
-- por empresa). El push es un aviso operativo corto AL CONDUCTOR (nuevo
-- viaje asignado, nuevo mensaje de chat, nuevo viaje de afiliado) — mismo
-- alcance ya aceptado de "solo espanol por ahora" que el resto de la app
-- movil del conductor.

CREATE TABLE public.device_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  expo_push_token   TEXT NOT NULL UNIQUE,
  platform          TEXT NOT NULL DEFAULT 'android',
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- El usuario gestiona SOLO sus propios tokens (registrar/actualizar/borrar
-- al cerrar sesion). Las lecturas para ENVIAR push siempre pasan por
-- service-role desde el servidor, no necesitan policy de SELECT para otros.
CREATE POLICY "users_manage_own_device_tokens"
  ON public.device_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
