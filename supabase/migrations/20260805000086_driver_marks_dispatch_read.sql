-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 86: el conductor puede marcar como leídos sus mensajes de Dispatch.
--
-- La migración 24 (driver_messages) le dio al conductor SELECT/INSERT sobre su
-- propio canal, pero ningún UPDATE. En la web esto no hacía falta porque
-- `markDriverChannelMessagesReadAction` corre server-side con el admin client
-- (bypassa RLS); la app nativa del conductor, que lee/escribe directo por RLS
-- (mismo patrón que trip_messages en passenger-mobile, sin ruta de servidor),
-- no tenía forma de marcar como leídos los mensajes de Dispatch (sender =
-- 'dispatch') sin este policy.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "driver_marks_dispatch_messages_read"
  ON public.driver_messages FOR UPDATE
  USING (driver_id = auth.uid() AND sender = 'dispatch')
  WITH CHECK (driver_id = auth.uid() AND sender = 'dispatch');
