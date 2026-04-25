CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT,
  code TEXT NOT NULL UNIQUE,
  qr_payload TEXT NOT NULL,
  qr_code_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP,
  checked_in_at TIMESTAMP
);

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS qr_payload TEXT,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE tickets
SET
  qr_payload = COALESCE(qr_payload, qr_code_payload),
  updated_at = COALESCE(updated_at, NOW())
WHERE qr_payload IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets (order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets (customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_session_id ON tickets (session_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
