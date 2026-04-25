CREATE TABLE IF NOT EXISTS lots (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0,
  max_per_customer INTEGER,
  sales_start_at TIMESTAMP,
  sales_end_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS price INTEGER,
  ADD COLUMN IF NOT EXISTS stock INTEGER,
  ADD COLUMN IF NOT EXISTS sold INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_per_customer INTEGER,
  ADD COLUMN IF NOT EXISTS sales_start_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sales_end_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE lots
SET
  price = COALESCE(price, price_cents),
  stock = COALESCE(stock, quantity_total, quantity_available),
  sold = COALESCE(sold, GREATEST(COALESCE(quantity_total, 0) - COALESCE(quantity_available, 0), 0)),
  sales_start_at = COALESCE(sales_start_at, sales_starts_at),
  sales_end_at = COALESCE(sales_end_at, sales_ends_at),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  price IS NULL
  OR stock IS NULL;

ALTER TABLE lots
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN stock SET NOT NULL,
  ALTER COLUMN session_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_lots_session_id ON lots (session_id);
CREATE INDEX IF NOT EXISTS idx_lots_tenant_id ON lots (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots (status);
