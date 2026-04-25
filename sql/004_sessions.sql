CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE sessions
SET
  timezone = COALESCE(timezone, 'America/Sao_Paulo'),
  capacity = COALESCE(capacity, 0),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  timezone IS NULL
  OR capacity IS NULL;

ALTER TABLE sessions
  ALTER COLUMN capacity SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_sessions_event_id ON sessions (event_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_id ON sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_starts_at ON sessions (starts_at);
