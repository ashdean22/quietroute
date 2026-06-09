import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const { deviceId, vibes, vibeScores, score, thumb } = await req.json()

  if (!thumb || !deviceId)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  await pool.query(
    `INSERT INTO ratings (device_id, vibes, vibe_scores, score, thumb)
     VALUES ($1, $2, $3, $4, $5)`,
    [deviceId, vibes ?? [], vibeScores ? JSON.stringify(vibeScores) : null, score ?? null, thumb]
  )

  return NextResponse.json({ ok: true })
}
