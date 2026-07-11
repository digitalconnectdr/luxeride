-- QuickBooks Online integration (Gaps mayores pospuestos, docs/PENDING.md item 8).
-- Cada empresa conecta SU PROPIA cuenta de QuickBooks Online (mismo modelo que
-- Stripe Connect / Whop Connect), via OAuth2. A diferencia de Stripe/Whop, QBO
-- no permite crear sub-cuentas desde una API key de plataforma, asi que se
-- necesita guardar el access_token/refresh_token por empresa (el refresh_token
-- rota en cada uso, se sobreescribe).
--
-- Sincroniza dos cosas:
--   1. Un Sales Receipt por reserva completada (bookings.quickbooks_synced_at).
--   2. Una Invoice de QuickBooks por cada invoice corporativa generada por el
--      cron existente de facturacion (invoices.quickbooks_synced_at).

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS quickbooks_realm_id text,
  ADD COLUMN IF NOT EXISTS quickbooks_access_token text,
  ADD COLUMN IF NOT EXISTS quickbooks_refresh_token text,
  ADD COLUMN IF NOT EXISTS quickbooks_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS quickbooks_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS quickbooks_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quickbooks_item_id text,
  ADD COLUMN IF NOT EXISTS quickbooks_last_synced_at timestamptz;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS quickbooks_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS quickbooks_sales_receipt_id text;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_id text,
  ADD COLUMN IF NOT EXISTS quickbooks_synced_at timestamptz;

-- Indice parcial: el cron de sync recorre "completadas sin sincronizar" por
-- empresa; sin esto seria un escaneo completo de bookings en cada corrida.
CREATE INDEX IF NOT EXISTS idx_bookings_quickbooks_pending
  ON bookings (company_id, status)
  WHERE quickbooks_synced_at IS NULL AND status = 'completed';
