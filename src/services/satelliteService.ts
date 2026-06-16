import { SatelliteAnalysis, CalizaZone } from '../types'

export async function analyzeSatelliteRegion(
  latitude: number,
  longitude: number,
  radiusKm: number = 5,
): Promise<SatelliteAnalysis> {
  const zones = generateMockZones(latitude, longitude, radiusKm)
  const analysis: SatelliteAnalysis = {
    id: `sat_${Date.now()}`,
    location: { latitude, longitude },
    date: Date.now(),
    source: 'sentinel2',
    ndvi: 0.35 + Math.random() * 0.3,
    clayRatio: 0.15 + Math.random() * 0.2,
    carbonateIndex: 0.4 + Math.random() * 0.5,
    quartzIndex: 0.1 + Math.random() * 0.3,
    zones,
  }

  return analysis
}

function generateMockZones(
  lat: number,
  lon: number,
  radiusKm: number,
): CalizaZone[] {
  const zones: CalizaZone[] = []
  const numZones = 3 + Math.floor(Math.random() * 5)

  for (let i = 0; i < numZones; i++) {
    const centerLat = lat + (Math.random() - 0.5) * (radiusKm / 55)
    const centerLon = lon + (Math.random() - 0.5) * (radiusKm / 55) / Math.cos(lat * Math.PI / 180)
    const prob = Math.random()
    const numPoints = 10 + Math.floor(Math.random() * 15)

    const coordinates: { latitude: number; longitude: number }[] = []
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2
      const r = (Math.random() * 0.3 + 0.7) * (radiusKm / 100)
      coordinates.push({
        latitude: centerLat + r * Math.cos(angle),
        longitude: centerLon + r * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180),
      })
    }

    zones.push({
      id: `zone_${Date.now()}_${i}`,
      coordinates,
      probability: prob > 0.6 ? 'alta' : prob > 0.3 ? 'media' : 'baja',
      confidence: 0.5 + Math.random() * 0.4,
      source: 'satellite',
    })
  }

  return zones
}

export function getCarbonateIndexDescription(index: number): string {
  if (index > 0.7) return 'Alta probabilidad de carbonatos'
  if (index > 0.5) return 'Probabilidad media de carbonatos'
  if (index > 0.3) return 'Baja probabilidad de carbonatos'
  return 'Muy baja probabilidad de carbonatos'
}

export function getNDVIDescription(ndvi: number): string {
  if (ndvi < 0.1) return 'Suelo desnudo / roca expuesta - buena visibilidad'
  if (ndvi < 0.3) return 'Vegetación escasa - visibilidad parcial'
  if (ndvi < 0.5) return 'Vegetación moderada - puede ocultar afloramientos'
  return 'Vegetación densa - difícil detección'
}

export function analyzeSWIRBands(
  bandShort: number,
  bandLong: number,
): { carbonateIndex: number; clayRatio: number; confidence: number } {
  const ratio = bandShort / bandLong
  const carbonateIndex = Math.min(1, Math.max(0, 1 - Math.abs(ratio - 1.5) / 1.5))
  const clayRatio = Math.min(1, Math.max(0, ratio > 1.2 ? (ratio - 1.2) / 0.8 : 0))

  return {
    carbonateIndex,
    clayRatio,
    confidence: 0.7 + Math.random() * 0.25,
  }
}

export async function downloadSatelliteImagery(
  latitude: number,
  longitude: number,
  onProgress?: (progress: number) => void,
): Promise<string> {
  onProgress?.(0)
  await new Promise(r => setTimeout(r, 500))
  onProgress?.(0.5)
  const tileUrl = `https://api.sentinel-hub.com/v1/process?lat=${latitude}&lon=${longitude}`
  onProgress?.(1)
  return tileUrl
}
