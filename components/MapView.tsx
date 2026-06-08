'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import { useEffect } from 'react'

const LYNCHBURG: [number, number] = [37.4138, -79.1422]

// ── Bearing between two [lat, lng] points (degrees, clockwise from north) ────
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toR = Math.PI / 180
  const φ1 = lat1 * toR, φ2 = lat2 * toR
  const Δλ = (lng2 - lng1) * toR
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// ── Internal sub-components ──────────────────────────────────────────────────

function ClickHandler({ onClick }: { onClick: (latlng: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

function FlyToHandler({ location }: { location: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (location) map.flyTo(location, 14)
  }, [location, map])
  return null
}

function FitBoundsHandler({ coords }: { coords: [number, number][] | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords && coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40] })
    }
  }, [coords, map])
  return null
}

// Directional arrows rendered as imperatively-added Leaflet markers so they
// don't re-trigger the react-leaflet reconciler on every render.
function ArrowsLayer({ coords }: { coords: [number, number][] | null }) {
  const map = useMap()

  useEffect(() => {
    if (!coords || coords.length < 3) return

    const markers: L.Marker[] = []
    const step = Math.max(1, Math.floor(coords.length / 7))

    for (let i = step; i < coords.length - 1; i += step) {
      const [lat1, lng1] = coords[i]
      const [lat2, lng2] = coords[Math.min(i + 2, coords.length - 1)]
      const b = bearing(lat1, lng1, lat2, lng2)

      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;transform:rotate(${b}deg)">
                 <svg width="12" height="12" viewBox="0 0 12 12">
                   <polygon points="6,0 12,11 0,11" fill="#4f46e5" opacity="0.85"/>
                 </svg>
               </div>`,
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })

      markers.push(
        L.marker([lat1, lng1], { icon, interactive: false, keyboard: false }).addTo(map)
      )
    }

    return () => markers.forEach((m) => m.removeFrom(map))
  }, [coords, map])

  return null
}

// ── Public component ─────────────────────────────────────────────────────────

interface MapViewProps {
  startPoint: [number, number] | null
  onMapClick: (latlng: [number, number]) => void
  flyTo: [number, number] | null
  routeCoords: [number, number][] | null
}

export default function MapView({ startPoint, onMapClick, flyTo, routeCoords }: MapViewProps) {
  return (
    <MapContainer
      center={LYNCHBURG}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onMapClick} />
      <FlyToHandler location={flyTo} />
      <FitBoundsHandler coords={routeCoords} />

      {/* Double-stroke polyline: white halo + indigo line on top */}
      {routeCoords && (
        <>
          <Polyline positions={routeCoords} color="white"   weight={9} opacity={0.7} />
          <Polyline positions={routeCoords} color="#4f46e5" weight={5} opacity={0.9} />
        </>
      )}
      <ArrowsLayer coords={routeCoords} />

      {startPoint && <Marker position={startPoint} />}
    </MapContainer>
  )
}
