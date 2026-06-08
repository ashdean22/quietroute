'use client'

import RouteStats, { type RouteStatsData } from '@/components/RouteStats'

const VIBES = ['Flat', 'Shaded', 'Low-traffic', 'Quiet'] as const

interface InputPanelProps {
  startPoint: [number, number] | null
  distance: number
  setDistance: (v: number) => void
  activity: 'run' | 'bike'
  setActivity: (v: 'run' | 'bike') => void
  vibes: string[]
  setVibes: (v: string[]) => void
  hasRoute: boolean
  loading: boolean
  error: string | null
  routeStats: RouteStatsData | null
  unit: 'km' | 'mi'
  onToggleUnit: () => void
  onUseMyLocation: () => void
  onFindRoutes: () => void
  onRegenerate: () => void
}

export default function InputPanel({
  startPoint,
  distance,
  setDistance,
  activity,
  setActivity,
  vibes,
  setVibes,
  hasRoute,
  loading,
  error,
  routeStats,
  unit,
  onToggleUnit,
  onUseMyLocation,
  onFindRoutes,
  onRegenerate,
}: InputPanelProps) {
  const toggleVibe = (vibe: string) => {
    setVibes(
      vibes.includes(vibe) ? vibes.filter((v) => v !== vibe) : [...vibes, vibe]
    )
  }

  return (
    <aside className="h-64 md:h-full md:w-80 overflow-y-auto bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col p-5 gap-5 shrink-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">QuietRoute</h1>
        <p className="text-sm text-gray-500">Find a loop by vibe</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Start point</p>
        <button
          onClick={onUseMyLocation}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Use my location
        </button>
        {startPoint ? (
          <p className="text-xs text-emerald-600 font-medium">
            Set: {startPoint[0].toFixed(4)}, {startPoint[1].toFixed(4)}
          </p>
        ) : (
          <p className="text-xs text-gray-400">or click the map to drop a pin</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <p className="text-sm font-medium text-gray-700">Distance</p>
          <span className="text-sm font-semibold text-indigo-600">{distance} km</span>
        </div>
        <input
          type="range"
          min={1}
          max={15}
          value={distance}
          onChange={(e) => setDistance(Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1 km</span>
          <span>15 km</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Activity</p>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['run', 'bike'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setActivity(type)}
              disabled={loading}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize disabled:opacity-50 ${
                activity === type
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type === 'run' ? 'Run' : 'Bike'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Vibe</p>
        <div className="flex flex-wrap gap-2">
          {VIBES.map((vibe) => (
            <button
              key={vibe}
              onClick={() => toggleVibe(vibe)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
                vibes.includes(vibe)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {vibe}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={onFindRoutes}
          disabled={!startPoint || loading}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Finding best route…
            </>
          ) : (
            'Find routes'
          )}
        </button>

        {hasRoute && (
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-colors bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Regenerate
          </button>
        )}
      </div>

      {routeStats && (
        <RouteStats stats={routeStats} unit={unit} onToggleUnit={onToggleUnit} />
      )}
    </aside>
  )
}
