-- Migration 45: Seccion G, Fase 2 - Portal de afiliado externo.
-- Ver docs/PENDING.md seccion G ("Fase 2 - Portal de afiliado externo") para
-- el diseno completo. Resumen:
--
-- - Una empresa FUERA de LuxeRide se une a la Red de Afiliados de quien la
--   invita a traves de un link de invitacion de un solo uso (capability-URL,
--   mismo patron que bookings.id en /track/[id]) - no un directorio publico.
-- - Al aceptar la invitacion se crea una fila REAL en companies (marcada
--   is_external_affiliate = true, sin plan/suscripcion de LuxeRide), para que
--   su conductor/vehiculo se registren en las MISMAS tablas drivers/vehicles
--   que ya existen - nada de texto libre ni un esquema paralelo.
-- - Whop Connect (ya construido, migracion 32) sigue siendo obligatorio antes
--   de poder aceptar cualquier solicitud paga - se aplica en codigo
--   (respondToAffiliateTripAction), no aqui.

ALTER TABLE public.companies
  ADD COLUMN is_external_affiliate BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE public.affiliate_invite_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviting_company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token                 TEXT NOT NULL UNIQUE,
  coverage_notes        TEXT,
  created_by            UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  used_at               TIMESTAMPTZ,
  used_by_company_id    UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_affiliate_invite_tokens_inviting ON public.affiliate_invite_tokens(inviting_company_id);

-- RLS habilitada por convencion del proyecto; sin politicas - esta tabla solo
-- se toca via service-role (server actions + la pagina publica de alta, que
-- sigue el mismo patron capability-URL que /track/[id]).
ALTER TABLE public.affiliate_invite_tokens ENABLE ROW LEVEL SECURITY;
