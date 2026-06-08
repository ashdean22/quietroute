'use client'

import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { useEffect } from 'react'

const LYNCHBURG: [number, number] = [37.4138, -79.1422]

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

interface MapViewProps {
  startPoint: [number, number] | null
  onMapClick: (latlng: [number, number]) => void
  flyTo: [number, number] | null
}

export default function MapView({ startPoint, onMapClick, flyTo }: MapViewProps) {
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
      {startPoint && <Marker position={startPoint} />}
    </MapContainer>
  )
}
