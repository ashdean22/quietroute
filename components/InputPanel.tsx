'use client'

import RouteStats, { type RouteStatsData } from '@/components/RouteStats'

const VIBES = ['Flat', 'Shaded', 'Low-traffic', 'Quiet'] as const

export interface SavedRoute {
  id: string
  createdAt: string
  distanceM: number
  vibeMix: Record<string, number> | null
  label: string | null
  coordinates: [number, number][]
}

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
  // Day 6
  onRate: (thumb: 'up' | 'down') => void
  onSaveRoute: () => void
  hasRated: boolean
  hasSaved: boolean
  savedRoutes: SavedRoute[]
  onLoadSavedRoute: (route: SavedRoute) => void
  activeTab: 'plan' | 'saved'
  onTabChange: (tab: 'plan' | 'saved') => void
}

function fmtDistShort(m: number): string {
  return `${(m / 1000).toFixed(1)} km`
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
  onRate,
  onSaveRoute,
  hasRated,
  hasSaved,
  savedRoutes,
  onLoadSavedRoute,
  activeTab,
  onTabChange,
}: InputPanelProps) {
  const toggleVibe = (vibe: string) => {
    setVibes(
      vibes.includes(vibe) ? vibes.filter((v) => v !== vibe) : [...vibes, vibe]
    )
  }

  const weather = routeStats?.weather

  return (
    <aside className="h-64 md:h-full md:w-80 overflow-y-auto bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">QuietRoute</h1>
        <p className="text-sm text-gray-500">Find a loop by vibe</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 px-5">
        {(['plan', 'saved'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'saved' ? `Saved${savedRoutes.length > 0 ? ` (${savedRoutes.length})` : ''}` : 'Plan'}
          </button>
        ))}
      </div>

      {activeTab === 'saved' ? (
        /* ── Saved Routes tab ──────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {savedRoutes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">No saved routes yet.<br />Find a route and hit Save.</p>
          ) : (
            savedRoutes.map((r) => (
              <button
                key={r.id}
                onClick={() => onLoadSavedRoute(r)}
                className="w-full text-left rounded-xl border border-gray-200 p-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-800">
                  {r.label ?? fmtDistShort(r.distanceM)} loop
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {fmtDistShort(r.distanceM)} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
                {r.vibeMix && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(r.vibeMix)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 3)
                      .map(([k, v]) => (
                        <span key={k} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">
                          {k.replace('_', '-')} {Math.round(v)}
                        </span>
                      ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        /* ── Plan tab ──────────────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto flex flex-col px-5 gap-5 py-4">
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
            <>
              <RouteStats stats={routeStats} unit={unit} onToggleUnit={onToggleUnit} />

              {/* Weather chip */}
              {weather && (
                <div className={`rounded-xl px-3 py-2.5 text-sm flex items-center justify-between gap-2 ${
                  weather.goodToRun ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-xs">{weather.bestTimeChip}</span>
                    <span className="text-xs opacity-80">
                      {weather.feelsLike}°C feels like · {weather.windSpeed} km/h wind
                      {weather.precip > 0 ? ` · ${weather.precip.toFixed(1)} mm` : ''}
                    </span>
                  </div>
                  <span className="text-lg leading-none">{weather.goodToRun ? '✓' : '⏱'}</span>
                </div>
              )}

              {/* Rate + Save row */}
              <div className="flex gap-2 pb-2">
                <button
                  onClick={() => onRate('up')}
                  disabled={hasRated}
                  title="Good route"
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
                    hasRated
                      ? 'bg-gray-50 border-gray-200 text-gray-400'
                      : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  👍 Good
                </button>
                <button
                  onClick={() => onRate('down')}
                  disabled={hasRated}
                  title="Not for me"
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
                    hasRated
                      ? 'bg-gray-50 border-gray-200 text-gray-400'
                      : 'bg-white border-red-300 text-red-700 hover:bg-red-50'
                  }`}
                >
                  👎 Pass
                </button>
                <button
                  onClick={onSaveRoute}
                  disabled={hasSaved}
                  title="Save this route"
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    hasSaved
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  {hasSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
