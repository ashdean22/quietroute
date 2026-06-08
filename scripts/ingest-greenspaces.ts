import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

// ── City configuration — keep in sync with ingest-osm.ts ─────────────────────
const CITY = 'Lynchburg, VA'
const BBOX = { south: 37.350, west: -79.260, north: 37.480, east: -79.050 }
// ─────────────────────────────────────────────────────────────────────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const BATCH_SIZE = 500

interface OverpassNode { lat: number; lon: number }
interface OverpassElement {
  type: 'way' | 'node'
  id: number
  lat?: number   // present on node elements
  lon?: number
  geometry?: OverpassNode[]  // present on way elements with out geom
  tags?: Record<string, string>
}

async function fetchOverpass(): Promise<OverpassElement[]> {
  const { south, west, north, east } = BBOX
  const query =
    `[out:json][timeout:90];` +
    `(` +
    `  way[leisure=park](${south},${west},${north},${east});` +
    `  way[leisure=garden](${south},${west},${north},${east});` +
    `  way[natural=wood](${south},${west},${north},${east});` +
    `  way[natural=scrub](${south},${west},${north},${east});` +
    `  way[landuse=forest](${south},${west},${north},${east});` +
    `  way[landuse=grass](${south},${west},${north},${east});` +
    `  way[landuse=meadow](${south},${west},${north},${east});` +
    `  node[natural=tree](${south},${west},${north},${east});` +
    `);` +
    `out geom;`

  console.log(`Querying Overpass for ${CITY} greenspaces…`)
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'QuietRoute/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json() as { elements: OverpassElement[] }
  return data.elements
}

function buildGeojson(el: OverpassElement): string | null {
  if (el.type === 'node') {
    if (el.lat == null || el.lon == null) return null
    return JSON.stringify({ type: 'Point', coordinates: [el.lon, el.lat] })
  }
  // way
  if (!el.geometry || el.geometry.length < 2) return null
  const coords: [number, number][] = el.geometry.map((pt) => [pt.lon, pt.lat])
  // Closed ring → Polygon; open → LineString
  const first = coords[0], last = coords[coords.length - 1]
  const isClosed = first[0] === last[0] && first[1] === last[1]
  if (isClosed && coords.length >= 4) {
    return JSON.stringify({ type: 'Polygon', coordinates: [coords] })
  }
  return JSON.stringify({ type: 'LineString', coordinates: coords })
}

async function insertBatch(pool: Pool, elements: OverpassElement[]): Promise<number> {
  const osmIds: number[] = []
  const osmTypes: string[] = []
  const geojsons: string[] = []
  const names: (string | null)[] = []
  const tags: string[] = []

  for (const el of elements) {
    const geojson = buildGeojson(el)
    if (!geojson) continue
    osmIds.push(el.id)
    osmTypes.push(el.type)
    geojsons.push(geojson)
    names.push(el.tags?.name ?? null)
    tags.push(JSON.stringify(el.tags ?? {}))
  }

  if (osmIds.length === 0) return 0

  await pool.query(
    `INSERT INTO greenspaces (osm_id, osm_type, geom, name, tags)
     SELECT
       unnest($1::bigint[]),
       unnest($2::text[]),
       ST_SetSRID(ST_GeomFromGeoJSON(unnest($3::text[])), 4326),
       unnest($4::text[]),
       unnest($5::text[])::jsonb
     ON CONFLICT (osm_id, osm_type) DO NOTHING`,
    [osmIds, osmTypes, geojsons, names, tags]
  )
  return osmIds.length
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const elements = await fetchOverpass()
    console.log(`Received ${elements.length} elements from Overpass`)

    let inserted = 0
    for (let i = 0; i < elements.length; i += BATCH_SIZE) {
      const n = await insertBatch(pool, elements.slice(i, i + BATCH_SIZE))
      inserted += n
    }

    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM greenspaces')
    console.log(`Inserted ${inserted} greenspace features → ${rows[0].n} total in table`)
  } finally {
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
