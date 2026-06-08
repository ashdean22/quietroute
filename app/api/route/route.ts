import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions'

const PROFILES: Record<string, string> = {
  run: 'foot-walking',
  bike: 'cycling-regular',
}

// UI vibe label → vibe_score jsonb key
const VIBE_KEY: Record<string, string> = {
  Flat: 'flat',
  Shaded: 'shaded',
  'Low-traffic': 'low_traffic',
  Quiet: 'quiet',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function totalClimbM(elevations: number[]): number {
  let climb = 0
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i] - elevations[i - 1]
    if (d > 0) climb += d
  }
  return Math.round(climb)
}

function flatScore(climbM: number): number {
  // 0 m climb → 100 (flat), 100 m climb → 0
  return Math.max(0, Math.round(100 - climbM))
}

function combinedScore(
  segVibes: { quiet: number; low_traffic: number; shaded: number },
  flatSc: number,
  selectedVibes: string[]
): number {
  const all: Record<string, number> = {
    flat: flatSc,
    shaded: segVibes.shaded,
    low_traffic: segVibes.low_traffic,
    quiet: segVibes.quiet,
  }
  const keys =
    selectedVibes.length > 0
      ? selectedVibes.map((v) => VIBE_KEY[v]).filter(Boolean)
      : Object.keys(all)
  return keys.reduce((sum, k) => sum + (all[k] ?? 50), 0) / keys.length
}

function buildVerdict(
  scores: { quiet: number; low_traffic: number; shaded: number; flat: number },
  climbM: number,
  selectedVibes: string[]
): string {
  const sel = new Set(selectedVibes)
  const want = (v: string) => sel.size === 0 || sel.has(v)
  const parts: string[] = []

  if (want('Shaded')) {
    if (scores.shaded >= 70) parts.push('Mostly shaded')
    else if (scores.shaded < 30) parts.push('Exposed')
  }
  if (want('Low-traffic') && scores.low_traffic >= 70) parts.push('Low-traffic')
  if (want('Quiet') && scores.quiet >= 70) parts.push('Quiet roads')
  if (want('Flat')) {
    if (climbM <= 25) parts.push('Flat')
    else if (climbM <= 60) parts.push('Gentle hills')
    else parts.push('Hilly')
  }

  if (parts.length === 0) parts.push('Mixed terrain')
  parts.push(`+${climbM} m climb`)
  return parts.join(' · ') + ' (estimated)'
}

// Down-sample an array to at most maxLen points (for elevation chart transfer)
function downsample(arr: number[], maxLen: number): number[] {
  if (arr.length <= maxLen) return arr
  const step = (arr.length - 1) / (maxLen - 1)
  return Array.from({ length: maxLen }, (_, i) => arr[Math.round(i * step)])
}

// ── ORS fetch ─────────────────────────────────────────────────────────────────

interface OrsCandidate {
  seed: number
  coordinates: [number, number][]   // [lat, lng] Leaflet-ready
  elevations: number[]              // parallel to coordinates
  routeGeojson: string             // [lng, lat] 2-D GeoJSON for PostGIS
  distanceM: number
  durationS: number
  climbM: number
}

async function fetchOrsCandidate(
  apiKey: string,
  profile: string,
  start: [number, number],   // [lng, lat]
  distanceKm: number,
  seed: number
): Promise<OrsCandidate> {
  const res = await fetch(`${ORS_BASE}/${profile}/geojson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({
      coordinates: [start],
      options: { round_trip: { length: distanceKm * 1000, points: 5, seed } },
      elevation: true,
      instructions: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `ORS ${res.status}`)
  }

  const geojson = await res.json()
  const feature = geojson.features?.[0]
  if (!feature) throw new Error('No route in ORS response')

  const raw: number[][] = feature.geometry.coordinates

  const coordinates = raw.map(([lng, lat]) => [lat, lng] as [number, number])
  const elevations  = raw.map(([, , e]) => e ?? 0)
  // 2-D LineString for PostGIS (drop elevation, keep [lng,lat] GeoJSON order)
  const routeGeojson = JSON.stringify({
    type: 'LineString',
    coordinates: raw.map(([lng, lat]) => [lng, lat]),
  })

  const climb = totalClimbM(elevations)

  return {
    seed,
    coordinates,
    elevations,
    routeGeojson,
    distanceM: Math.round(feature.properties.summary.distance),
    durationS: Math.round(feature.properties.summary.duration),
    climbM: climb,
  }
}

// ── PostGIS vibe scoring ──────────────────────────────────────────────────────

async function scoreViaPostgis(
  routeGeojson: string
): Promise<{ quiet: number; low_traffic: number; shaded: number }> {
  try {
    const { rows } = await pool.query<{
      quiet: string; low_traffic: string; shaded: string
    }>(
      `SELECT
         COALESCE(AVG((vibe_score->>'quiet')::float),      50)::float AS quiet,
         COALESCE(AVG((vibe_score->>'low_traffic')::float),50)::float AS low_traffic,
         COALESCE(AVG((vibe_score->>'shaded')::float),     50)::float AS shaded
       FROM segments
       WHERE ST_DWithin(
               geom::geography,
               ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography,
               25
             )
         AND vibe_score IS NOT NULL`,
      [routeGeojson]
    )
    const r = rows[0]
    return {
      quiet:       Math.round(Number(r.quiet)),
      low_traffic: Math.round(Number(r.low_traffic)),
      shaded:      Math.round(Number(r.shaded)),
    }
  } catch {
    return { quiet: 50, low_traffic: 50, shaded: 50 }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY
  if (!apiKey)
    return NextResponse.json({ error: 'ORS API key not configured' }, { status: 500 })

  const { start, distanceKm, activity, seed, vibes = [] } = await req.json()

  if (!start || !distanceKm || !activity)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const profile = PROFILES[activity] ?? 'foot-walking'
  const seeds = [seed, seed + 1, seed + 2, seed + 3]

  // 1. Fetch 4 ORS candidates in parallel; keep successful ones
  const settled = await Promise.allSettled(
    seeds.map((s) => fetchOrsCandidate(apiKey, profile, start, distanceKm, s))
  )
  const candidates = settled
    .filter((r): r is PromiseFulfilledResult<OrsCandidate> => r.status === 'fulfilled')
    .map((r) => r.value)

  if (candidates.length === 0) {
    const msg = (settled[0] as PromiseRejectedResult).reason?.message ?? 'All routing attempts failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // 2. Score each candidate against PostGIS segment vibes (in parallel)
  const scored = await Promise.all(
    candidates.map(async (c) => {
      const segVibes = await scoreViaPostgis(c.routeGeojson)
      const flat = flatScore(c.climbM)
      const score = combinedScore(segVibes, flat, vibes)
      return { ...c, segVibes, flatSc: flat, score }
    })
  )

  // 3. Pick winner
  const winner = scored.reduce((best, c) => (c.score > best.score ? c : best))

  const allScores = {
    quiet:       winner.segVibes.quiet,
    low_traffic: winner.segVibes.low_traffic,
    shaded:      winner.segVibes.shaded,
    flat:        winner.flatSc,
  }

  return NextResponse.json({
    coordinates: winner.coordinates,
    elevationM:  downsample(winner.elevations, 100),
    distanceM:   winner.distanceM,
    durationS:   winner.durationS,
    climbM:      winner.climbM,
    vibeScores:  allScores,
    verdict:     buildVerdict(allScores, winner.climbM, vibes),
  })
}
