-- Sección J: Compliance Center — datos regulatorios EE.UU.
-- Aditivo: no toca ninguna columna/tabla existente. Solo agrega columnas
-- indexables (fechas/estados que consulta el cron) + JSONB `compliance`
-- para el resto de campos MVP, en companies, drivers y vehicles.
--
-- compliance_status: 'compliant' | 'partial' | 'at_risk' | 'non_compliant' | 'pending_review'
-- El score y el status se calculan en lib/compliance/engine.ts (empresa: solo
-- alerta, nunca bloquea la operación; conductor/vehículo: pueden bloquear
-- asignación de viajes vía operational_block).

-- ─── companies ─────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN compliance JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN operating_license_expires_at DATE,
  ADD COLUMN commercial_insurance_expires_at DATE,
  ADD COLUMN compliance_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (compliance_status IN ('compliant', 'partial', 'at_risk', 'non_compliant', 'pending_review')),
  ADD COLUMN compliance_score INTEGER NOT NULL DEFAULT 0 CHECK (compliance_score BETWEEN 0 AND 100),
  ADD COLUMN compliance_alert BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN compliance_last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN compliance_reviewed_by UUID REFERENCES public.user_profiles(id);
-- "manual_review_required" NO es una columna: se deriva de
-- compliance_last_reviewed_at IS NULL (nunca revisado → pendiente de
-- aprobación admin la primera vez, igual para companies/drivers/vehicles).

CREATE INDEX idx_companies_compliance_status ON public.companies(compliance_status);
CREATE INDEX idx_companies_operating_license_expires ON public.companies(operating_license_expires_at)
  WHERE operating_license_expires_at IS NOT NULL;
CREATE INDEX idx_companies_commercial_insurance_expires ON public.companies(commercial_insurance_expires_at)
  WHERE commercial_insurance_expires_at IS NOT NULL;

-- ─── drivers ────────────────────────────────────────────────────────────────

ALTER TABLE public.drivers
  ADD COLUMN compliance JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN chauffeur_permit_expires_at DATE,
  ADD COLUMN compliance_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (compliance_status IN ('compliant', 'partial', 'at_risk', 'non_compliant', 'pending_review')),
  ADD COLUMN compliance_score INTEGER NOT NULL DEFAULT 0 CHECK (compliance_score BETWEEN 0 AND 100),
  ADD COLUMN operational_block BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN block_reason TEXT,
  ADD COLUMN compliance_last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN compliance_reviewed_by UUID REFERENCES public.user_profiles(id);

CREATE INDEX idx_drivers_compliance_status ON public.drivers(compliance_status);
CREATE INDEX idx_drivers_operational_block ON public.drivers(company_id, operational_block) WHERE operational_block = TRUE;
CREATE INDEX idx_drivers_chauffeur_permit_expires ON public.drivers(chauffeur_permit_expires_at)
  WHERE chauffeur_permit_expires_at IS NOT NULL;

-- ─── vehicles ───────────────────────────────────────────────────────────────

ALTER TABLE public.vehicles
  ADD COLUMN compliance JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN forhire_permit_expires_at DATE,
  ADD COLUMN inspection_date DATE,
  ADD COLUMN compliance_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (compliance_status IN ('compliant', 'partial', 'at_risk', 'non_compliant', 'pending_review')),
  ADD COLUMN compliance_score INTEGER NOT NULL DEFAULT 0 CHECK (compliance_score BETWEEN 0 AND 100),
  ADD COLUMN operational_block BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN block_reason TEXT,
  ADD COLUMN compliance_last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN compliance_reviewed_by UUID REFERENCES public.user_profiles(id);

CREATE INDEX idx_vehicles_compliance_status ON public.vehicles(compliance_status);
CREATE INDEX idx_vehicles_operational_block ON public.vehicles(company_id, operational_block) WHERE operational_block = TRUE;
CREATE INDEX idx_vehicles_forhire_permit_expires ON public.vehicles(forhire_permit_expires_at)
  WHERE forhire_permit_expires_at IS NOT NULL;
CREATE INDEX idx_vehicles_inspection_date ON public.vehicles(inspection_date) WHERE inspection_date IS NOT NULL;
