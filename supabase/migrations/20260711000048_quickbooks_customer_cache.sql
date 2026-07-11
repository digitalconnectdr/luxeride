-- Migration 48: cache local de clientes de QuickBooks por nombre normalizado.
-- Ver docs/PENDING.md seccion "Gaps mayores" -> QuickBooks Online.
--
-- Problema: findOrCreateCustomer buscaba el cliente en QuickBooks por
-- DisplayName EXACTO (sensible a mayusculas/espacios) via la Query API de
-- QBO - si el mismo pasajero aparecia con distinta capitalizacion o espacios
-- extra entre reservas, se creaba un Customer duplicado en QuickBooks por
-- cada variante.
--
-- Solucion: en vez de depender de una busqueda exacta contra QBO en cada
-- sync, LuxeRide guarda su propio mapeo (nombre normalizado -> customer id de
-- QBO) por empresa. La normalizacion (trim + colapsar espacios + minusculas)
-- vive en lib/quickbooks/sync.ts (normalizeCustomerName, funcion pura y
-- testeada). Esto tambien reduce llamadas a la API de QBO (ya no hace falta
-- una Query por cada sync, solo la primera vez que se ve ese nombre).

CREATE TABLE public.quickbooks_customers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  normalized_name        TEXT NOT NULL,
  display_name           TEXT NOT NULL,
  quickbooks_customer_id TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, normalized_name)
);

CREATE INDEX idx_quickbooks_customers_company ON public.quickbooks_customers(company_id);

-- RLS habilitada por convencion del proyecto; sin politicas - esta tabla solo
-- se toca via service-role (lib/quickbooks/sync.ts, siempre desde server
-- actions/crons ya autorizados, nunca desde el cliente).
ALTER TABLE public.quickbooks_customers ENABLE ROW LEVEL SECURITY;
