-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 79: recompensa de cumpleaños.
--
-- `user_profiles.date_of_birth` ya existe desde la migración 69 (se pide al
-- registrarse en la app), así que el dato estaba; faltaba usarlo.
--
-- El cumpleaños rompe dos supuestos del diseño de la 78:
--
--   1. No lo dispara ningún viaje ni ninguna reseña. Lo dispara el calendario,
--      así que lo evalúa un cron diario, no el flujo de completar viaje.
--   2. SE REPITE cada año. El UNIQUE (rule_id, customer_key) de la 78 daría
--      la recompensa una sola vez en la vida del cliente. Por eso se agrega
--      `period_key`: para el cumpleaños es el año ('2026'), y para todo lo
--      demás es 'once', que conserva exactamente el comportamiento anterior.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Nuevo disparador ──────────────────────────────────────────────────────

ALTER TABLE public.reward_rules
  DROP CONSTRAINT reward_rules_trigger_type_check;

ALTER TABLE public.reward_rules
  ADD CONSTRAINT reward_rules_trigger_type_check CHECK (trigger_type IN (
    'trips_completed', 'total_spent', 'first_trip', 'inactivity_days',
    'review_submitted', 'birthday'
  ));

-- El cumpleaños no lleva umbral: la condición es la fecha, no una cantidad.
ALTER TABLE public.reward_rules
  DROP CONSTRAINT reward_rules_threshold_required;

ALTER TABLE public.reward_rules
  ADD CONSTRAINT reward_rules_threshold_required CHECK (
    (trigger_type IN ('first_trip', 'review_submitted', 'birthday') AND threshold IS NULL)
    OR (trigger_type NOT IN ('first_trip', 'review_submitted', 'birthday') AND threshold IS NOT NULL AND threshold > 0)
  );

-- ── 2. Periodo de la recompensa ──────────────────────────────────────────────

-- 'once' por defecto: las filas que ya existen son de reglas no recurrentes y
-- deben conservar el significado "una sola vez por cliente".
ALTER TABLE public.reward_grants
  ADD COLUMN period_key TEXT NOT NULL DEFAULT 'once';

ALTER TABLE public.reward_grants
  DROP CONSTRAINT reward_grants_rule_id_customer_key_key;

-- La garantía dura contra otorgar dos veces sigue siendo esta, ahora por
-- periodo: una vez por cliente para las reglas normales, una vez por año para
-- el cumpleaños.
ALTER TABLE public.reward_grants
  ADD CONSTRAINT reward_grants_rule_customer_period_key
  UNIQUE (rule_id, customer_key, period_key);

-- ── 3. Índice acorde a cómo se consulta de verdad ────────────────────────────

-- La consulta real siempre es por empresa Y cliente (ver lib/rewards/grant.ts).
-- El índice de la 78 era solo por customer_key.
DROP INDEX IF EXISTS idx_reward_grants_customer;
CREATE INDEX idx_reward_grants_customer
  ON public.reward_grants(company_id, customer_key);

-- El cron de cumpleaños busca perfiles por empresa con fecha de nacimiento.
CREATE INDEX idx_user_profiles_birthday
  ON public.user_profiles(company_id, date_of_birth)
  WHERE date_of_birth IS NOT NULL AND role = 'customer';
