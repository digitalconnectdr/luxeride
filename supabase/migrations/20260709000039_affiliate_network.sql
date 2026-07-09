-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 39: Sección G — LuxeRide Affiliate Network (Fase 1, MVP privado).
-- Ver docs/PENDING.md sección G para el diseño completo. Resumen del modelo:
--
-- - El viaje afiliado es una entidad SEPARADA (affiliate_trips), no una
--   reasignación del booking original — la empresa principal (owner) nunca
--   pierde la relación comercial con el pasajero. bookings.company_id /
--   driver_id / vehicle_id NUNCA se tocan por este flujo.
-- - Antes de aceptar, el afiliado solo debe ver una vista limitada (zona,
--   fecha/hora, tipo de vehículo, pasajeros, precio ofrecido, distancia/
--   duración estimadas) — nunca nombre completo, teléfono o dirección exacta.
--   Esto se resuelve en la capa de aplicación (server actions/componentes de
--   servidor con service-role que seleccionan columnas explícitas), NO con
--   RLS de columna (Postgres RLS es por fila, no por columna) — mismo patrón
--   que ya usa /track/[id] para el pasajero sin sesión. Por eso NO se agregan
--   políticas RLS nuevas sobre `bookings` para la empresa afiliada.
-- - MVP: un solo afiliado a la vez por solicitud (sin pools/bidding — eso es
--   Fase 3/4). Liquidación manual (sin split automático de Whop Connect).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Monetización: interruptor por empresa ──────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN affiliate_network_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN affiliate_network_enabled_at TIMESTAMPTZ;

-- Incluido de fábrica en Elite/Enterprise (según docs/PENDING.md sección G,
-- tabla comparativa de planes); Starter/Professional lo activan como add-on
-- (autoservicio con lead a ventas, o el super-admin lo concede manualmente).
UPDATE public.companies
SET affiliate_network_enabled = TRUE, affiliate_network_enabled_at = NOW()
WHERE plan IN ('elite', 'enterprise');

-- ── Relación de afiliación entre dos empresas (aprobación mutua) ──────────────
CREATE TABLE public.company_affiliates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  affiliate_company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  -- Perfil ligero del afiliado (cobertura/pago) — MVP en texto libre; la
  -- sección J (Compliance Center) ya cubre licencia/seguro por empresa, no se
  -- duplica aquí.
  coverage_notes        TEXT,
  payment_terms         TEXT NOT NULL DEFAULT 'net_15' CHECK (payment_terms IN ('due_on_receipt', 'net_7', 'net_15', 'net_30')),
  requested_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  responded_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  responded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_affiliates_no_self CHECK (requester_company_id != affiliate_company_id),
  CONSTRAINT company_affiliates_unique_pair UNIQUE (requester_company_id, affiliate_company_id)
);

CREATE INDEX idx_company_affiliates_requester ON public.company_affiliates(requester_company_id, status);
CREATE INDEX idx_company_affiliates_affiliate ON public.company_affiliates(affiliate_company_id, status);

CREATE TRIGGER company_affiliates_updated_at
  BEFORE UPDATE ON public.company_affiliates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.company_affiliates ENABLE ROW LEVEL SECURITY;

-- Cualquiera de las dos empresas (staff con rol de gestión) ve la relación.
CREATE POLICY "companies_read_own_affiliate_relations"
  ON public.company_affiliates FOR SELECT
  USING (
    (requester_company_id = public.auth_company_id() OR affiliate_company_id = public.auth_company_id())
    AND public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

-- Solo se puede solicitar en nombre de la propia empresa.
CREATE POLICY "companies_request_affiliation"
  ON public.company_affiliates FOR INSERT
  WITH CHECK (
    requester_company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin')
  );

-- Cualquiera de las dos partes puede actualizar (aprobar/rechazar/revocar) —
-- la app valida en el server action que quien aprueba no sea quien solicitó.
CREATE POLICY "companies_update_own_affiliate_relations"
  ON public.company_affiliates FOR UPDATE
  USING (
    (requester_company_id = public.auth_company_id() OR affiliate_company_id = public.auth_company_id())
    AND public.auth_has_role('company_owner', 'company_admin')
  );

-- ── Viaje enviado a un afiliado ────────────────────────────────────────────────
CREATE TABLE public.affiliate_trips (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  company_affiliate_id  UUID NOT NULL REFERENCES public.company_affiliates(id) ON DELETE RESTRICT,
  owner_company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  affiliate_company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  status                TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
                           'requested', 'accepted', 'rejected', 'countered', 'expired', 'cancelled',
                           'en_route', 'arrived', 'in_progress', 'completed'
                         )),
  reason                TEXT NOT NULL DEFAULT 'other' CHECK (reason IN (
                           'no_driver', 'out_of_zone', 'overcapacity', 'better_affiliate_rate', 'other'
                         )),
  branding_mode         TEXT NOT NULL DEFAULT 'white_label' CHECK (branding_mode IN ('white_label', 'operated_by', 'co_branded')),

  -- Vista limitada que ve el afiliado ANTES de aceptar (copiada del booking al
  -- crear la solicitud — así nunca se le expone el booking completo desde el
  -- cliente mientras está en 'requested'; ver nota de RLS arriba).
  preview_zone          TEXT,
  preview_scheduled_at  TIMESTAMPTZ NOT NULL,
  preview_vehicle_type  TEXT,
  preview_passenger_count INTEGER NOT NULL DEFAULT 1,
  preview_distance_miles NUMERIC(8,2),
  preview_duration_minutes INTEGER,

  -- Dinero: lo que paga el pasajero ya está en bookings.total_amount; aquí solo
  -- lo que le corresponde al afiliado y el margen resultante para el owner.
  offered_price         NUMERIC(10,2) NOT NULL CHECK (offered_price >= 0),
  countered_price       NUMERIC(10,2) CHECK (countered_price IS NULL OR countered_price >= 0),
  agreed_price          NUMERIC(10,2) CHECK (agreed_price IS NULL OR agreed_price >= 0),
  passenger_charged_amount NUMERIC(10,2),
  margin_amount         NUMERIC(10,2),

  driver_id             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  vehicle_id            UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,

  expires_at            TIMESTAMPTZ NOT NULL,
  responded_at          TIMESTAMPTZ,
  dispatched_at         TIMESTAMPTZ,
  en_route_at           TIMESTAMPTZ,
  arrived_at            TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,

  -- Liquidación (manual en el MVP — ver docs/PENDING.md sección G).
  settlement_status     TEXT NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'invoiced', 'paid', 'disputed')),
  settlement_method     TEXT,
  settlement_notes      TEXT,
  settled_at            TIMESTAMPTZ,
  settled_by            UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,

  requested_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_affiliate_trips_booking ON public.affiliate_trips(booking_id);
CREATE INDEX idx_affiliate_trips_owner ON public.affiliate_trips(owner_company_id, status);
CREATE INDEX idx_affiliate_trips_affiliate ON public.affiliate_trips(affiliate_company_id, status);
CREATE INDEX idx_affiliate_trips_driver ON public.affiliate_trips(driver_id);

-- Un booking solo puede tener UNA solicitud activa a la vez en el MVP (sin
-- pools) — evita mandarlo a dos afiliados en simultáneo por error.
CREATE UNIQUE INDEX idx_affiliate_trips_one_active_per_booking
  ON public.affiliate_trips(booking_id)
  WHERE status IN ('requested', 'accepted', 'countered', 'en_route', 'arrived', 'in_progress');

CREATE TRIGGER affiliate_trips_updated_at
  BEFORE UPDATE ON public.affiliate_trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.affiliate_trips ENABLE ROW LEVEL SECURITY;

-- Empresa principal (dueña del pasajero): lee/gestiona sus solicitudes salientes.
CREATE POLICY "owner_manages_affiliate_trips"
  ON public.affiliate_trips FOR ALL
  USING (
    owner_company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

-- Empresa afiliada: lee/gestiona sus solicitudes entrantes (aceptar, rechazar,
-- contraofertar, asignar conductor/vehículo propio, avanzar estado).
CREATE POLICY "affiliate_manages_affiliate_trips"
  ON public.affiliate_trips FOR ALL
  USING (
    affiliate_company_id = public.auth_company_id() AND
    public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

-- El conductor del afiliado ve y actualiza SUS viajes asignados (para que
-- pueda operarlos desde /driver/trips igual que un viaje propio).
CREATE POLICY "affiliate_driver_reads_own_affiliate_trips"
  ON public.affiliate_trips FOR SELECT
  USING (driver_id = auth.uid());

CREATE POLICY "affiliate_driver_updates_own_affiliate_trips"
  ON public.affiliate_trips FOR UPDATE
  USING (driver_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_trips;

-- ── Mensajería entre empresas (canal 1: comercial · canal 2: operativo) ────────
-- El canal 3 (conductor afiliado ↔ su propio dispatcher) reutiliza
-- driver_messages, ya existente. El canal 4 (pasajero↔conductor) reutiliza
-- trip_messages, condicionado en la app al branding_mode.
CREATE TABLE public.affiliate_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_affiliate_id  UUID NOT NULL REFERENCES public.company_affiliates(id) ON DELETE CASCADE,
  affiliate_trip_id     UUID REFERENCES public.affiliate_trips(id) ON DELETE CASCADE,
  sender_company_id     UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_user_id        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  body                  TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_affiliate_messages_relation ON public.affiliate_messages(company_affiliate_id, created_at);
CREATE INDEX idx_affiliate_messages_trip ON public.affiliate_messages(affiliate_trip_id, created_at);

ALTER TABLE public.affiliate_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_read_affiliate_messages"
  ON public.affiliate_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_affiliates ca
      WHERE ca.id = affiliate_messages.company_affiliate_id
        AND (ca.requester_company_id = public.auth_company_id() OR ca.affiliate_company_id = public.auth_company_id())
    ) AND public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

CREATE POLICY "companies_write_affiliate_messages"
  ON public.affiliate_messages FOR INSERT
  WITH CHECK (
    sender_company_id = public.auth_company_id() AND
    EXISTS (
      SELECT 1 FROM public.company_affiliates ca
      WHERE ca.id = affiliate_messages.company_affiliate_id
        AND (ca.requester_company_id = public.auth_company_id() OR ca.affiliate_company_id = public.auth_company_id())
    ) AND public.auth_has_role('company_owner', 'company_admin', 'dispatcher')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_messages;

-- ── Leads de autoservicio (Starter/Professional piden activar el add-on) ──────
-- Mismo patrón que enterprise_leads (migración 31) — venta consultiva, sin
-- checkout automático todavía (no hay producto de Whop dedicado creado aún).
CREATE TYPE affiliate_network_lead_status AS ENUM ('new', 'contacted', 'converted', 'rejected');

CREATE TABLE public.affiliate_network_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  requested_by   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  company_name   TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  message        TEXT,
  status         affiliate_network_lead_status NOT NULL DEFAULT 'new',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_affiliate_network_leads_status ON public.affiliate_network_leads(status, created_at);
CREATE INDEX idx_affiliate_network_leads_company ON public.affiliate_network_leads(company_id);

CREATE TRIGGER affiliate_network_leads_updated_at
  BEFORE UPDATE ON public.affiliate_network_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.affiliate_network_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manages_affiliate_network_leads"
  ON public.affiliate_network_leads FOR ALL
  USING (public.auth_has_role('super_admin'));

-- Nota: el interruptor affiliate_network_enabled de `companies` lo escribe
-- el super-admin vía server action con service-role (createAdminClient()),
-- igual que updateCompanyPlan/updatePlanQuotaAction — no hace falta una
-- policy RLS nueva para eso (el resto de escrituras de super-admin sobre
-- `companies` tampoco tiene una).
