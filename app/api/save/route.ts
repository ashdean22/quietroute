import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const { deviceId, coordinates, distanceM, vibeMix, label } = await req.json()

  if (!deviceId || !coordinates?.length)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  const geojson = JSON.stringify({
    type: 'LineString',
    coordinates: (coordinates as [number, number][]).map(([lat, lng]) => [lng, lat]),
  })

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO routes (device_id, geom, distance_m, vibe_mix, label)
     VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), $3, $4, $5)
     RETURNING id`,
    [deviceId, geojson, distanceM ?? null, vibeMix ? JSON.stringify(vibeMix) : null, label ?? null]
  )

  return NextResponse.json({ id: rows[0].id })
}
