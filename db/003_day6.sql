-- QuietRoute Day 6: expand routes + ratings for saved routes + RL ratings
-- Apply via: npm run migrate

ALTER TABLE routes
  ADD COLUMN IF NOT EXISTS device_id  text,
  ADD COLUMN IF NOT EXISTS geom       geometry(LineString, 4326),
  ADD COLUMN IF NOT EXISTS distance_m float8,
  ADD COLUMN IF NOT EXISTS vibe_mix   jsonb,
  ADD COLUMN IF NOT EXISTS label      text;

CREATE INDEX IF NOT EXISTS routes_device_idx ON routes (device_id) WHERE device_id IS NOT NULL;

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS device_id   text,
  ADD COLUMN IF NOT EXISTS vibes       text[],
  ADD COLUMN IF NOT EXISTS vibe_scores jsonb,
  ADD COLUMN IF NOT EXISTS score       float8,
  ADD COLUMN IF NOT EXISTS thumb       text;  -- 'up' | 'down'
