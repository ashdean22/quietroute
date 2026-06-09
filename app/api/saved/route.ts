import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId')
  if (!deviceId) return NextResponse.json({ routes: [] })

  const { rows } = await pool.query<{
    id: string
    created_at: string
    distance_m: number
    vibe_mix: Record<string, number> | null
    label: string | null
    geom: string | null
  }>(
    `SELECT id, created_at, distance_m, vibe_mix, label, ST_AsGeoJSON(geom) AS geom
     FROM routes
     WHERE device_id = $1 AND geom IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 20`,
    [deviceId]
  )

  return NextResponse.json({
    routes: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      distanceM: r.distance_m,
      vibeMix: r.vibe_mix,
      label: r.label,
      coordinates: r.geom
        ? (JSON.parse(r.geom).coordinates as [number, number][]).map(
            ([lng, lat]) => [lat, lng] as [number, number]
          )
        : [],
    })),
  })
}
