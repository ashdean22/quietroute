import { NextRequest, NextResponse } from 'next/server'

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions'

const PROFILES: Record<string, string> = {
  run: 'foot-walking',
  bike: 'cycling-regular',
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ORS API key not configured' }, { status: 500 })
  }

  const { start, distanceKm, activity, seed } = await req.json()

  if (!start || !distanceKm || !activity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const profile = PROFILES[activity] ?? 'foot-walking'

  const body = {
    coordinates: [start], // [lng, lat] — ORS/GeoJSON order
    options: {
      round_trip: {
        length: distanceKm * 1000,
        points: 5,
        seed: seed ?? 1,
      },
    },
    elevation: true,
    instructions: false,
  }

  try {
    const orsRes = await fetch(`${ORS_BASE}/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey, // ORS does NOT use "Bearer" prefix
      },
      body: JSON.stringify(body),
    })

    if (!orsRes.ok) {
      const errData = await orsRes.json().catch(() => ({}))
      const message =
        errData?.error?.message ?? `Routing service error (${orsRes.status})`
      return NextResponse.json({ error: message }, { status: orsRes.status })
    }

    const geojson = await orsRes.json()
    const feature = geojson.features?.[0]

    if (!feature) {
      return NextResponse.json({ error: 'No route returned from ORS' }, { status: 502 })
    }

    // Flip [lng, lat, elevation?] → [lat, lng] for Leaflet
    const coordinates: [number, number][] = feature.geometry.coordinates.map(
      ([lng, lat]: number[]) => [lat, lng] as [number, number]
    )

    return NextResponse.json({
      coordinates,
      distanceM: Math.round(feature.properties.summary.distance),
    })
  } catch (err) {
    console.error('ORS fetch error:', err)
    return NextResponse.json({ error: 'Failed to reach routing service' }, { status: 502 })
  }
}
