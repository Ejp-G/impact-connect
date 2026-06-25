'use client'
import { useEffect, useRef } from 'react'

const COMMUNES_COORDS = {
  'Pointe-à-Pitre': [16.2418, -61.5330],
  'Les Abymes':     [16.2680, -61.5080],
  'Baie-Mahault':   [16.2700, -61.5870],
  'Le Gosier':      [16.2000, -61.4960],
  'Sainte-Anne':    [16.2260, -61.3830],
  'Saint-François': [16.2570, -61.2810],
  'Le Moule':       [16.3330, -61.3500],
  'Capesterre-Belle-Eau': [16.0440, -61.5670],
  'Basse-Terre':    [15.9960, -61.7250],
  'Gourbeyre':      [16.0040, -61.6830],
  'Trois-Rivières': [15.9780, -61.6600],
  'Saint-Claude':   [16.0220, -61.7020],
  'Bouillante':     [16.1290, -61.7700],
  'Vieux-Habitants':[16.0670, -61.7620],
  'Deshaies':       [16.3040, -61.7960],
  'Sainte-Rose':    [16.3280, -61.7010],
  'Lamentin':       [16.2720, -61.6370],
  'Petit-Bourg':    [16.1960, -61.5770],
  'Goyave':         [16.1350, -61.5570],
  'Morne-à-l\'Eau': [16.3340, -61.5370],
  'Port-Louis':     [16.4170, -61.5330],
  'Anse-Bertrand':  [16.4720, -61.5110],
  'Saint-Louis':    [15.9600, -61.3480],
  'Capesterre-de-Marie-Galante': [15.8900, -61.2280],
  'Grand-Bourg':    [15.8700, -61.3120],
}

export default function CarteLeaflet({ counts }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    if (instanceRef.current) return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = window.L
      const map = L.map(mapRef.current).setView([16.15, -61.55], 10)
      instanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      const max = Math.max(...Object.values(counts), 1)

      Object.entries(counts).forEach(([commune, count]) => {
        const coords = COMMUNES_COORDS[commune]
        if (!coords) return

        const radius = 14 + (count / max) * 28
        const opacity = 0.5 + (count / max) * 0.4

        L.circleMarker(coords, {
          radius,
          fillColor: '#0B3D91',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: opacity,
        })
          .addTo(map)
          .bindPopup(`<strong>${commune}</strong><br/>${count} personne${count > 1 ? 's' : ''}`)
      })

      if (Object.keys(counts).length === 0) {
        const defaultCommunes = [
          ['Pointe-à-Pitre', [16.2418, -61.5330]],
          ['Les Abymes', [16.2680, -61.5080]],
          ['Basse-Terre', [15.9960, -61.7250]],
        ]
        defaultCommunes.forEach(([name, coords]) => {
          L.marker(coords)
            .addTo(map)
            .bindPopup(`<strong>${name}</strong>`)
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove()
        instanceRef.current = null
      }
    }
  }, [counts])

  return (
    <div
      ref={mapRef}
      style={{ height: 480, width: '100%', background: '#f0f4f8' }}
    />
  )
}
