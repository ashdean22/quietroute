'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import InputPanel from '@/components/InputPanel'
import type { RouteStatsData } from '@/components/RouteStats'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="flex-1 bg-slate-100 animate-pulse" />,
})

export default function Home() {
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null)
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null)
  const [distance, setDistance] = useState(5)
  const [activity, setActivity] = useState<'run' | 'bike'>('run')
  const [vibes, setVibes] = useState<string[]>([])
  const [seed, setSeed] = useState(1)
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null)
  const [routeStats, setRouteStats] = useState<RouteStatsData | null>(null)
  const [unit, setUnit] = useState<'km' | 'mi'>('km')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMapClick = useCallback((latlng: [number, number]) => {
    setStartPoint(latlng)
  }, [])

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setStartPoint(loc)
        setFlyTo(loc)
      },
      () => {
        // denied — map stays on Lynchburg fallback
      }
    )
  }

  const fetchRoute = async (s: number) => {
    if (!startPoint) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: [startPoint[1], startPoint[0]], // flip [lat,lng] → [lng,lat] for ORS
          distanceKm: distance,
          activity,
          seed: s,
          vibes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Routing failed')
      setRouteCoords(data.coordinates)
      setRouteStats({
        distanceM: data.distanceM,
        durationS: data.durationS,
        elevationM: data.elevationM,
        climbM: data.climbM,
        verdict: data.verdict,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleFindRoutes = () => fetchRoute(seed)

  const handleRegenerate = () => {
    const next = seed + 4 // advance by the candidate window size
    setSeed(next)
    fetchRoute(next)
  }

  return (
    <div className="flex flex-col h-screen md:flex-row">
      <div className="flex-1 min-h-0">
        <MapView
          startPoint={startPoint}
          onMapClick={handleMapClick}
          flyTo={flyTo}
          routeCoords={routeCoords}
        />
      </div>
      <InputPanel
        startPoint={startPoint}
        distance={distance}
        setDistance={setDistance}
        activity={activity}
        setActivity={setActivity}
        vibes={vibes}
        setVibes={setVibes}
        hasRoute={routeCoords !== null}
        loading={loading}
        error={error}
        routeStats={routeStats}
        unit={unit}
        onToggleUnit={() => setUnit((u) => (u === 'km' ? 'mi' : 'km'))}
        onUseMyLocation={handleUseMyLocation}
        onFindRoutes={handleFindRoutes}
        onRegenerate={handleRegenerate}
      />
    </div>
  )
}
