const KEY = 'quietroute_vibe_weights'

export type VibeWeights = { flat: number; shaded: number; low_traffic: number; quiet: number }

const DEFAULT: VibeWeights = { flat: 1.0, shaded: 1.0, low_traffic: 1.0, quiet: 1.0 }

export function getWeights(): VibeWeights {
  if (typeof window === 'undefined') return { ...DEFAULT }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT }
  } catch {
    return { ...DEFAULT }
  }
}

// Called on each rating. Returns the updated weights.
export function nudgeWeights(
  thumb: 'up' | 'down',
  vibeScores: Record<string, number>
): VibeWeights {
  const w = getWeights()

  if (thumb === 'up') {
    // Reinforce high-scoring vibes — user liked this mix
    for (const k of Object.keys(w) as (keyof VibeWeights)[]) {
      const score = vibeScores[k] ?? 50
      if (score >= 60) w[k] = Math.min(3, w[k] + 0.15)
    }
  } else {
    // Route was bad — the low-scoring vibes were underrepresented; boost them
    for (const k of Object.keys(w) as (keyof VibeWeights)[]) {
      const score = vibeScores[k] ?? 50
      if (score < 50) w[k] = Math.min(3, w[k] + 0.2)
      else w[k] = Math.max(0.3, w[k] - 0.05)
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(w))
  }
  return w
}
