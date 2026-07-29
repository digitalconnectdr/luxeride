-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 78: reseñas externas (Google / TripAdvisor) + recompensas automáticas
--
-- Dos features que llegan juntas porque comparten un mismo límite de política:
-- ni Google ni TripAdvisor permiten publicar reseñas por API (solo leerlas y
-- responderlas), y desde febrero 2026 Google prohíbe expresamente incentivar
-- reseñas y hacer "review gating". Por eso:
--   1. Lo de Google/TripAdvisor es un ENLACE que se le ofrece a TODO el que
--      califica, sin premio de por medio. La reseña la escribe la persona.
--   2. Las recompensas se disparan por COMPORTAMIENTO (viajes, gasto,
--      inactividad), nunca por la PUNTUACIÓN que dejó el pasajero. Premiar
--      puntuaciones altas ademas corromperia `drivers.rating`, que es lo que
--      usa el score de auto-asignacion para repartir viajes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Presencia externa del operador ────────────────────────────────────────

ALTER TABLE public.companies
  -- Place ID de Google Business Profile. Con esto se arma el deep link
  -- https://search.google.com/local/writereview?placeid=<id>
  ADD COLUMN google_place_id TEXT,
  -- URL del listado en TripAdvisor. No hay deep link de "escribir reseña"
  -- documentado y estable, así que se enlaza el listado y el usuario navega.
  ADD COLUMN tripadvisor_url TEXT;

-- ── 2. Reglas de recompensa ──────────────────────────────────────────────────

CREATE TABLE public.reward_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,

  -- Deliberadamente NO existe un disparador por puntuación (ver cabecera).
  --   trips_completed  → al llegar a N viajes completados
  --   total_spent      → al acumular N de gasto
  --   first_trip       → al completar el primero
  --   inactivity_days  → tras N días sin viajar (reconquista)
  --   review_submitted → por DEJAR una reseña, sin importar cuántas estrellas
  trigger_type  TEXT NOT NULL CHECK (trigger_type IN (
    'trips_completed', 'total_spent', 'first_trip', 'inactivity_days', 'review_submitted'
  )),
  -- Umbral del disparador. NULL para first_trip y review_submitted, que no
  -- tienen umbral que medir.
  threshold     NUMERIC(10, 2),

  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  -- Días que vive el código generado antes de vencer.
  valid_days     INTEGER NOT NULL DEFAULT 90 CHECK (valid_days > 0),

  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un umbral es obligatorio justo para los disparadores que lo miden. Sin
  -- este CHECK una regla "al llegar a N viajes" con N nulo dispararia siempre.
  CONSTRAINT reward_rules_threshold_required CHECK (
    (trigger_type IN ('first_trip', 'review_submitted') AND threshold IS NULL)
    OR (trigger_type NOT IN ('first_trip', 'review_submitted') AND threshold IS NOT NULL AND threshold > 0)
  )
);

CREATE INDEX idx_reward_rules_company ON public.reward_rules(company_id, is_active);

-- ── 3. Recompensas ya otorgadas ──────────────────────────────────────────────

CREATE TABLE public.reward_grants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_id        UUID NOT NULL REFERENCES public.reward_rules(id) ON DELETE CASCADE,

  -- Identidad del cliente NORMALIZADA (email en minúsculas, o teléfono si no
  -- hay email). No se usa customer_id porque es NULL en toda reserva de
  -- invitado, que son la mayoría; `promo_code_redemptions` ya identifica al
  -- cliente por email/teléfono y aquí se sigue el mismo criterio.
  customer_key   TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,

  -- Reserva que gatilló la recompensa (para auditar por qué se otorgó).
  booking_id     UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  -- Código personal generado. Si se borra el código, el grant permanece como
  -- registro historico de que la regla ya se cumplio para este cliente.
  promo_code_id  UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Cada regla premia UNA vez por cliente. Es una garantía dura a nivel de
  -- base contra otorgar dos veces por una condición de carrera: regalar
  -- dinero dos veces es mucho peor que no regalarlo.
  UNIQUE (rule_id, customer_key)
);

CREATE INDEX idx_reward_grants_company  ON public.reward_grants(company_id, created_at DESC);
CREATE INDEX idx_reward_grants_customer ON public.reward_grants(customer_key);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.reward_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_grants ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro del staff de la empresa. La evaluación de reglas
-- corre con service-role desde el servidor, así que no necesita política.
CREATE POLICY "staff_read_reward_rules"
  ON public.reward_rules FOR SELECT
  USING (company_id = public.auth_company_id());

CREATE POLICY "admins_manage_reward_rules"
  ON public.reward_rules FOR ALL
  USING (
    company_id = public.auth_company_id()
    AND public.auth_has_role('company_owner', 'company_admin')
  )
  WITH CHECK (
    company_id = public.auth_company_id()
    AND public.auth_has_role('company_owner', 'company_admin')
  );

CREATE POLICY "staff_read_reward_grants"
  ON public.reward_grants FOR SELECT
  USING (company_id = public.auth_company_id());
