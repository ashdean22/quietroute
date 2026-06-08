import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(
            ST_SimplifyPreserveTopology(geom, 0.00005)
          )::json,
          'properties', json_build_object(
            'cluster',  cluster,
            'highway',  highway,
            'name',     name,
            'shaded',   (vibe_score->>'shaded')::int,
            'quiet',    (vibe_score->>'quiet')::int
          )
        )
      )
    ) AS fc
    FROM segments
    WHERE cluster IS NOT NULL
  `)

  const fc = rows[0]?.fc
  if (!fc) {
    return NextResponse.json(
      { error: 'No scored segments found. Run score-segments.py first.' },
      { status: 404 }
    )
  }

  return new NextResponse(JSON.stringify(fc), {
    headers: { 'Content-Type': 'application/geo+json' },
  })
}
