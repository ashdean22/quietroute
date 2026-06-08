-- QuietRoute Day 3: core schema
-- Apply via: npm run migrate

-- Road/path segments from OpenStreetMap
CREATE TABLE IF NOT EXISTS segments (
  id          bigserial PRIMARY KEY,
  osm_id      bigint UNIQUE NOT NULL,
  geom        geometry(LineString, 4326) NOT NULL,
  highway     text,
  surface     text,
  lit         text,
  name        text,
  tags        jsonb,
  length_m    float8,
  -- populated Days 4-5
  cluster     int,
  vibe_score  jsonb
);

CREATE INDEX IF NOT EXISTS segments_geom_gist ON segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS segments_cluster_idx ON segments (cluster) WHERE cluster IS NOT NULL;

-- Stub tables fleshed out Days 5-6
CREATE TABLE IF NOT EXISTS routes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id   uuid REFERENCES routes(id),
  created_at timestamptz DEFAULT now()
);
