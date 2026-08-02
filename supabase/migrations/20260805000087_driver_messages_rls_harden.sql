-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 87: endurecer RLS de driver_messages tras construir la app nativa
-- del canal Dispatch↔Conductor (DispatchChatScreen.tsx, apps/driver-mobile).
--
-- Hasta ahora ningún cliente disparaba escrituras reales contra estas
-- policies desde fuera del servidor (la web usa el admin client, que bypassa
-- RLS por completo). La nueva pantalla nativa sí escribe directo por RLS
-- (mismo patrón que trip_messages en passenger-mobile), así que dos huecos
-- que antes eran teóricos pasan a ser explotables de verdad:
--
--   1. "driver_writes_own_messages" (migración 24) nunca validaba que
--      company_id perteneciera de verdad al conductor — solo driver_id =
--      auth.uid(). Un cliente manipulado podía insertar un mensaje con el
--      company_id de OTRA empresa, y como "staff_reads_driver_messages"
--      filtra solo por company_id, ese mensaje forjado aparecería en el
--      inbox de dispatch de una empresa ajena.
--   2. La policy UPDATE agregada en la migración 86 (para que el conductor
--      marque como leído) solo exige sender='dispatch' — no impide que, en
--      la misma sentencia, el conductor cambie body/sender_name/company_id
--      de ese mensaje. RLS no puede restringir a nivel de columna, así que
--      se agrega un trigger que revierte cualquier campo que no sea read_at
--      cuando quien actualiza es el propio conductor (auth.uid() = driver_id
--      de la fila). Las actualizaciones de staff (admin client, sin sesión
--      de usuario) no pasan por auth.uid() y quedan sin tocar.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY "driver_writes_own_messages" ON public.driver_messages;

CREATE POLICY "driver_writes_own_messages"
  ON public.driver_messages FOR INSERT
  WITH CHECK (
    sender = 'driver' AND
    driver_id = auth.uid() AND
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.driver_messages_lock_fields_on_driver_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() = OLD.driver_id THEN
    NEW.body        := OLD.body;
    NEW.sender      := OLD.sender;
    NEW.sender_name := OLD.sender_name;
    NEW.company_id  := OLD.company_id;
    NEW.driver_id   := OLD.driver_id;
    NEW.created_at  := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER driver_messages_lock_fields
  BEFORE UPDATE ON public.driver_messages
  FOR EACH ROW EXECUTE FUNCTION public.driver_messages_lock_fields_on_driver_update();
