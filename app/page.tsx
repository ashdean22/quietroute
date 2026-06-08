'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import InputPanel from '@/components/InputPanel'

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

  const handleFindRoutes = () => {
    console.log({ startPoint, distance, activity, vibes })
  }

  return (
    <div className="flex flex-col h-screen md:flex-row">
      <div className="flex-1 min-h-0">
        <MapView
          startPoint={startPoint}
          onMapClick={handleMapClick}
          flyTo={flyTo}
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
        onUseMyLocation={handleUseMyLocation}
        onFindRoutes={handleFindRoutes}
      />
    </div>
  )
}
