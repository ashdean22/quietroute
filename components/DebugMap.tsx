'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import type { GeoJsonObject, Feature } from 'geojson'
import type { PathOptions } from 'leaflet'

const LYNCHBURG: [number, number] = [37.4138, -79.1422]

// One colour per cluster (up to 7)
const CLUSTER_COLORS = [
  '#ef4444', // red   — cluster 0
  '#f97316', // orange — cluster 1
  '#22c55e', // green  — cluster 2
  '#3b82f6', // blue   — cluster 3
  '#a855f7', // purple — cluster 4
  '#eab308', // yellow — cluster 5
  '#06b6d4', // cyan   — cluster 6
]

function clusterStyle(feature?: Feature): PathOptions {
  const cluster = (feature?.properties?.cluster ?? -1) as number
  return {
    color: CLUSTER_COLORS[cluster] ?? '#888888',
    weight: 2,
    opacity: 0.8,
  }
}

export default function DebugMap() {
  const [data, setData] = useState<GeoJsonObject | null>(null)
  const [status, setStatus] = useState('Loading cluster data…')

  useEffect(() => {
    fetch('/api/debug-clusters')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((fc) => {
        setData(fc)
        setStatus(`${fc.features?.length?.toLocaleString() ?? '?'} segments loaded`)
      })
      .catch((e) => setStatus(`Error: ${e.message}`))
  }, [])

  return (
    <div className="relative h-screen w-full">
      <MapContainer
        center={LYNCHBURG}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {data && <GeoJSON key="clusters" data={data} style={clusterStyle} />}
      </MapContainer>

      {/* Legend overlay */}
      <div className="absolute bottom-8 left-4 z-[1000] bg-white rounded-xl shadow-lg p-4 text-sm space-y-1">
        <p className="font-semibold text-gray-800 mb-2">Clusters</p>
        {CLUSTER_COLORS.slice(0, 5).map((color, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-4 h-2 rounded"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-600">Cluster {i}</span>
          </div>
        ))}
        <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">{status}</p>
      </div>
    </div>
  )
}
