CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE events
SET
  location = COALESCE(location, venue_name, city),
  status = COALESCE(status, CASE WHEN published THEN 'published' ELSE 'draft' END),
  starts_at = COALESCE(starts_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  location IS NULL
  OR starts_at IS NULL
  OR status IS NULL;

ALTER TABLE events
  ALTER COLUMN starts_at SET NOT NULL;

ALTER TABLE events
  ALTER COLUMN slug DROP NOT NULL,
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
