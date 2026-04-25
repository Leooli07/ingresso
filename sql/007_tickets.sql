CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES lots(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT,
  code TEXT NOT NULL UNIQUE,
  qr_code_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  checked_in_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets (order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_session_id ON tickets (session_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets (tenant_id);
