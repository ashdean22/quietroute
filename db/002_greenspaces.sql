-- QuietRoute Day 4: greenspace shade proxy + shade_dist_m on segments

ALTER TABLE segments ADD COLUMN IF NOT EXISTS shade_dist_m float8;

CREATE TABLE IF NOT EXISTS greenspaces (
  id       bigserial PRIMARY KEY,
  osm_id   bigint    NOT NULL,
  osm_type text      NOT NULL, -- 'way' or 'node' (different namespaces in OSM)
  geom     geometry(Geometry, 4326) NOT NULL,
  name     text,
  tags     jsonb,
  UNIQUE (osm_id, osm_type)
);

CREATE INDEX IF NOT EXISTS greenspaces_geom_gist ON greenspaces USING GIST (geom);
