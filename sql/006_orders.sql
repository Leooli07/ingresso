CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (tenant_id, phone);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE RESTRICT,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_document TEXT,
  total INTEGER,
  status TEXT NOT NULL DEFAULT 'reserved',
  payment_method TEXT,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS total INTEGER,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE orders
SET
  total = COALESCE(total, total_cents),
  updated_at = COALESCE(updated_at, NOW())
WHERE total IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders (event_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders (customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders (expires_at);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price INTEGER,
  unit_price_cents INTEGER NOT NULL,
  total_price_cents INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS price INTEGER;

UPDATE order_items
SET price = COALESCE(price, unit_price_cents)
WHERE price IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_lot_id ON order_items (lot_id);
