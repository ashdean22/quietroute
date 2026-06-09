'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import InputPanel, { type SavedRoute } from '@/components/InputPanel'
import type { RouteStatsData } from '@/components/RouteStats'
import { getDeviceId } from '@/lib/deviceId'
import { getWeights, nudgeWeights } from '@/lib/vibeWeights'

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
  // Day 6
  const [deviceId, setDeviceId] = useState('')
  const [hasRated, setHasRated] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([])
  const [activeTab, setActiveTab] = useState<'plan' | 'saved'>('plan')

  // Init device ID and load saved routes on mount
  useEffect(() => {
    const id = getDeviceId()
    setDeviceId(id)
    loadSavedRoutes(id)
  }, [])

  const loadSavedRoutes = async (id: string) => {
    if (!id) return
    try {
      const res = await fetch(`/api/saved?deviceId=${id}`)
      if (res.ok) {
        const data = await res.json()
        setSavedRoutes(data.routes)
      }
    } catch {
      // non-critical
    }
  }

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
    setHasRated(false)
    setHasSaved(false)
    try {
      const weights = getWeights()
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: [startPoint[1], startPoint[0]], // [lat,lng] → [lng,lat] for ORS
          distanceKm: distance,
          activity,
          seed: s,
          vibes,
          vibeWeights: weights,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Routing failed')
      setRouteCoords(data.coordinates)
      setRouteStats({
        distanceM:  data.distanceM,
        durationS:  data.durationS,
        elevationM: data.elevationM,
        climbM:     data.climbM,
        verdict:    data.verdict,
        vibeScores: data.vibeScores,
        weather:    data.weather ?? null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleFindRoutes = () => fetchRoute(seed)

  const handleRegenerate = () => {
    const next = seed + 4
    setSeed(next)
    fetchRoute(next)
  }

  const handleRate = async (thumb: 'up' | 'down') => {
    if (!routeStats || !routeCoords || hasRated) return
    setHasRated(true)

    // Nudge local weights first (immediate feedback)
    if (routeStats.vibeScores) {
      nudgeWeights(thumb, routeStats.vibeScores)
    }

    // Persist to DB (fire-and-forget; failure is silent)
    fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        vibes,
        vibeScores: routeStats.vibeScores,
        score: routeStats.vibeScores
          ? Object.values(routeStats.vibeScores).reduce((s, v) => s + v, 0) /
            Object.values(routeStats.vibeScores).length
          : null,
        thumb,
      }),
    }).catch(() => {})
  }

  const handleSaveRoute = async () => {
    if (!routeStats || !routeCoords || hasSaved) return
    setHasSaved(true)
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          coordinates: routeCoords,
          distanceM: routeStats.distanceM,
          vibeMix: routeStats.vibeScores ?? null,
          label: null,
        }),
      })
      // Refresh saved list
      loadSavedRoutes(deviceId)
    } catch {
      setHasSaved(false)
    }
  }

  const handleLoadSavedRoute = (route: SavedRoute) => {
    setRouteCoords(route.coordinates)
    setRouteStats(null) // clear stats — this is just a view
    setActiveTab('plan')
  }

  const handleTabChange = (tab: 'plan' | 'saved') => {
    setActiveTab(tab)
    if (tab === 'saved') loadSavedRoutes(deviceId)
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
        onRate={handleRate}
        onSaveRoute={handleSaveRoute}
        hasRated={hasRated}
        hasSaved={hasSaved}
        savedRoutes={savedRoutes}
        onLoadSavedRoute={handleLoadSavedRoute}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  )
}
