import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

// ── City configuration ───────────────────────────────────────────────────────
const CITY = 'Lynchburg, VA'
// Overpass bbox: south, west, north, east (all in decimal degrees)
const BBOX = { south: 37.350, west: -79.260, north: 37.480, east: -79.050 }
// ────────────────────────────────────────────────────────────────────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const HIGHWAY_RE = '^(footway|path|cycleway|pedestrian|living_street|residential|unclassified|track|bridleway)$'
const BATCH_SIZE = 500

interface OverpassNode { lat: number; lon: number }
interface OverpassElement {
  type: string
  id: number
  geometry?: OverpassNode[]
  tags?: Record<string, string>
}

// Haversine distance in meters between consecutive [lng, lat] coords
function lineLength(coords: [number, number][]): number {
  const R = 6_371_000
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]
    const [lon2, lat2] = coords[i]
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const dφ = ((lat2 - lat1) * Math.PI) / 180
    const dλ = ((lon2 - lon1) * Math.PI) / 180
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
    total += 2 * R * Math.asin(Math.sqrt(a))
  }
  return total
}

async function fetchOverpass(): Promise<OverpassElement[]> {
  const { south, west, north, east } = BBOX
  const query =
    `[out:json][timeout:90];` +
    `way[highway~"${HIGHWAY_RE}"](${south},${west},${north},${east});` +
    `out geom;`

  console.log(`Querying Overpass for ${CITY}…`)
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

async function insertBatch(
  pool: Pool,
  elements: OverpassElement[]
): Promise<number> {
  const osmIds: number[] = []
  const geojsons: string[] = []
  const highways: (string | null)[] = []
  const surfaces: (string | null)[] = []
  const lits: (string | null)[] = []
  const names: (string | null)[] = []
  const tags: string[] = []
  const lengths: number[] = []

  for (const el of elements) {
    if (!el.geometry || el.geometry.length < 2) continue

    // Overpass: {lat, lon} → GeoJSON: [lng, lat]
    const coords: [number, number][] = el.geometry.map((pt) => [pt.lon, pt.lat])

    osmIds.push(el.id)
    geojsons.push(JSON.stringify({ type: 'LineString', coordinates: coords }))
    highways.push(el.tags?.highway ?? null)
    surfaces.push(el.tags?.surface ?? null)
    lits.push(el.tags?.lit ?? null)
    names.push(el.tags?.name ?? null)
    tags.push(JSON.stringify(el.tags ?? {}))
    lengths.push(lineLength(coords))
  }

  if (osmIds.length === 0) return 0

  await pool.query(
    `INSERT INTO segments (osm_id, geom, highway, surface, lit, name, tags, length_m)
     SELECT
       unnest($1::bigint[]),
       ST_SetSRID(ST_GeomFromGeoJSON(unnest($2::text[])), 4326),
       unnest($3::text[]),
       unnest($4::text[]),
       unnest($5::text[]),
       unnest($6::text[]),
       unnest($7::text[])::jsonb,
       unnest($8::float8[])
     ON CONFLICT (osm_id) DO NOTHING`,
    [osmIds, geojsons, highways, surfaces, lits, names, tags, lengths]
  )

  return osmIds.length
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const elements = await fetchOverpass()
    const valid = elements.filter((el) => el.type === 'way' && el.geometry && el.geometry.length >= 2)
    console.log(`Received ${elements.length} ways from Overpass; ${valid.length} have geometry`)

    let inserted = 0
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const n = await insertBatch(pool, valid.slice(i, i + BATCH_SIZE))
      inserted += n
      const pct = Math.round(((i + BATCH_SIZE) / valid.length) * 100)
      process.stdout.write(`\r  Inserted ${inserted} / ${valid.length} (${Math.min(pct, 100)}%)`)
    }
    console.log()

    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM segments')
    console.log(`\nTotal segments in table: ${rows[0].n}`)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
