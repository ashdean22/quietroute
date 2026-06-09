'use client'

import type { WeatherData } from '@/app/api/route/route'

export type { WeatherData }

export interface RouteStatsData {
  distanceM: number
  durationS: number
  elevationM: number[]
  climbM: number
  verdict: string
  vibeScores?: { flat: number; shaded: number; low_traffic: number; quiet: number }
  weather?: WeatherData | null
}

interface RouteStatsProps {
  stats: RouteStatsData
  unit: 'km' | 'mi'
  onToggleUnit: () => void
}

function fmtDist(m: number, unit: 'km' | 'mi'): string {
  return unit === 'km'
    ? `${(m / 1000).toFixed(1)} km`
    : `${(m / 1609.344).toFixed(1)} mi`
}

function fmtTime(s: number): string {
  const m = Math.round(s / 60)
  if (m < 60) return `~${m} min`
  return `~${Math.floor(m / 60)} h ${m % 60} min`
}

function ElevationChart({ elevations }: { elevations: number[] }) {
  if (elevations.length < 2) return null

  const W = 100
  const H = 40
  const min = Math.min(...elevations)
  const max = Math.max(...elevations)
  const range = Math.max(max - min, 5)
  const pad = 0.08 // 8% top/bottom breathing room

  const pts = elevations.map((e, i) => {
    const x = (i / (elevations.length - 1)) * W
    const y = H - ((e - min) / range) * H * (1 - 2 * pad) - H * pad
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const lineD = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p}`)
    .join(' ')
  const areaD = `${lineD} L ${W},${H} L 0,${H} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 48 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#elev-fill)" />
      <path d={lineD} fill="none" stroke="#6366f1" strokeWidth="1.5" />
    </svg>
  )
}

export default function RouteStats({ stats, unit, onToggleUnit }: RouteStatsProps) {
  const { distanceM, durationS, elevationM, climbM, verdict } = stats
  const min = Math.round(Math.min(...elevationM))
  const max = Math.round(Math.max(...elevationM))

  return (
    <div className="border-t border-gray-200 pt-4 space-y-3">
      {/* Distance + time */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-2xl font-bold text-gray-900">
            {fmtDist(distanceM, unit)}
          </span>
          <span className="ml-2 text-sm text-gray-500">{fmtTime(durationS)}</span>
        </div>
        <button
          onClick={onToggleUnit}
          className="text-xs font-medium px-2 py-1 rounded border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          {unit === 'km' ? 'mi' : 'km'}
        </button>
      </div>

      {/* Elevation profile */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{min} m</span>
          <span className="text-gray-500 font-medium">Elevation</span>
          <span>{max} m</span>
        </div>
        <ElevationChart elevations={elevationM} />
        <p className="text-xs text-gray-400 text-right">+{climbM} m total climb</p>
      </div>

      {/* Verdict */}
      <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 leading-relaxed">
        {verdict}
      </p>
    </div>
  )
}
