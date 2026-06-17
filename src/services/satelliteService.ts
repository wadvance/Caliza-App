import { SatelliteAnalysis, CalizaZone } from '../types'

const SWIR_BAND_CENTERS = {
  sentinel2: { band11: 1610, band12: 2190 },
  landsat8: { band6: 1600, band7: 2200 },
}

function hashLocation(lat: number, lng: number): number {
  const h = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453
  return h - Math.floor(h)
}

function estimateElevation(lat: number, lng: number): number {
  const latN = lat + 9
  const panamaRidges = Math.sin(latN * 0.15) * 600 + Math.sin(latN * 0.4 + lng * 0.3) * 300
  const coastal = Math.max(0, 200 - Math.abs(lng + 80) * 100)
  return Math.max(0, Math.round(panamaRidges + coastal + hashLocation(lat, lng) * 200))
}

function simulateSWIRBands(lat: number, lng: number): {
  band11: number; band12: number; band6: number; band7: number
} {
  const h = hashLocation(lat, lng)
  const elev = estimateElevation(lat, lng)
  const isLowland = elev < 200
  const isCarbonate = (Math.sin(lat * 0.3 + lng * 0.5) * 0.5 + 0.5) > 0.55

  const base11 = isCarbonate ? 0.15 : 0.25
  const base12 = isCarbonate ? 0.35 : 0.20
  const clayFactor = isLowland ? 0.2 : 0.05

  return {
    band11: parseFloat((base11 + h * 0.1 + clayFactor * 0.1).toFixed(3)),
    band12: parseFloat((base12 + h * 0.08 + (1 - h) * 0.05).toFixed(3)),
    band6: parseFloat((base11 + 0.02 + h * 0.08).toFixed(3)),
    band7: parseFloat((base12 + 0.03 + (1 - h) * 0.06).toFixed(3)),
  }
}

export function analyzeSWIRBands(
  bandShort: number, bandLong: number,
): { carbonateIndex: number; clayRatio: number; confidence: number } {
  const ratio = bandShort / bandLong
  const carbonateIndex = parseFloat(Math.min(1, Math.max(0, 1 - Math.abs(ratio - 1.5) / 1.5)).toFixed(3))
  const clayRatio = parseFloat(Math.min(1, Math.max(0, ratio > 1.2 ? (ratio - 1.2) / 0.8 : 0)).toFixed(3))
  const confidence = parseFloat(Math.min(0.95, 0.65 + (carbonateIndex > 0.6 ? 0.2 : 0) + (ratio > 1.3 ? 0.1 : 0)).toFixed(2))
  return { carbonateIndex, clayRatio, confidence }
}

function generateZones(lat: number, lng: number, radiusKm: number): CalizaZone[] {
  const zones: CalizaZone[] = []
  const h = hashLocation(lat, lng)
  const elev = estimateElevation(lat, lng)
  const numZones = elev > 400 ? 5 : elev > 150 ? 4 : 3

  for (let i = 0; i < numZones; i++) {
    const offset = (i / numZones) * Math.PI * 2 + h * 2
    const dist = (0.3 + hashLocation(lat + i * 2, lng + i * 3)) * radiusKm / 80
    const centerLat = lat + dist * Math.cos(offset)
    const centerLng = lng + dist * Math.sin(offset) / Math.cos(lat * Math.PI / 180)

    const zH = hashLocation(centerLat, centerLng)
    const zElev = estimateElevation(centerLat, centerLng)
    const isCarbonateBearing = zElev > 100 && (Math.sin(centerLat * 0.3 + centerLng * 0.5) * 0.5 + 0.5) > 0.48

    const probScore = (isCarbonateBearing ? 0.6 : 0) + (zElev > 200 ? 0.15 : 0) + (zH > 0.5 ? 0.15 : 0)
    const probability = probScore > 0.7 ? 'alta' : probScore > 0.4 ? 'media' : 'baja'

    const numPoints = 12 + Math.floor(hashLocation(centerLat * 3, centerLng * 7) * 10)
    const coordinates: { latitude: number; longitude: number }[] = []
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2
      const r = (0.6 + hashLocation(centerLat + j, centerLng + j) * 0.4) * (radiusKm / 90 / Math.cos(centerLat * Math.PI / 180))
      coordinates.push({
        latitude: centerLat + r * Math.cos(angle) * 0.8,
        longitude: centerLng + r * Math.sin(angle) * 0.8,
      })
    }

    zones.push({
      id: `zone_swir_${Date.now()}_${i}`,
      coordinates,
      probability,
      confidence: parseFloat((0.55 + zH * 0.35).toFixed(2)),
      source: `SWIR analysis (zone ${i + 1})`,
      estimatedRockType: isCarbonateBearing && probScore > 0.5 ? 'caliza' : isCarbonateBearing ? 'marga' : 'arcilla',
    })
  }

  return zones
}

export async function analyzeSatelliteRegion(
  latitude: number, longitude: number, radiusKm: number = 5,
): Promise<SatelliteAnalysis> {
  const bands = simulateSWIRBands(latitude, longitude)
  const swirResult = analyzeSWIRBands(bands.band11, bands.band12)
  const landsatResult = analyzeSWIRBands(bands.band6, bands.band7)
  const carbonateIndex = parseFloat(((swirResult.carbonateIndex + landsatResult.carbonateIndex) / 2).toFixed(3))
  const clayRatio = parseFloat(((swirResult.clayRatio + landsatResult.clayRatio) / 2).toFixed(3))
  const ndvi = parseFloat(Math.max(0, Math.min(1, 0.5 - (hashLocation(latitude, longitude) * 0.4) + (estimateElevation(latitude, longitude) > 300 ? -0.1 : 0.15))).toFixed(3))
  const quartzIndex = parseFloat(Math.max(0, Math.min(1, clayRatio * 0.3 + (1 - carbonateIndex) * 0.4 + hashLocation(latitude + 10, longitude - 10) * 0.2)).toFixed(3))
  const zones = generateZones(latitude, longitude, radiusKm)

  const analysis: SatelliteAnalysis = {
    id: `sat_${Date.now()}`,
    location: { latitude, longitude },
    date: Date.now(),
    source: 'sentinel2',
    ndvi,
    clayRatio,
    carbonateIndex,
    quartzIndex,
    zones,
    swirBands: bands,
    elevation: estimateElevation(latitude, longitude),
  }

  return analysis
}

export function getCarbonateIndexDescription(index: number): string {
  if (index > 0.7) return 'Alta probabilidad de carbonatos — zona favorable para caliza'
  if (index > 0.5) return 'Probabilidad media de carbonatos — potencial moderado'
  if (index > 0.3) return 'Baja probabilidad de carbonatos'
  return 'Muy baja probabilidad de carbonatos'
}

export function getNDVIDescription(ndvi: number): string {
  if (ndvi < 0.1) return 'Suelo desnudo / roca expuesta — excelente visibilidad'
  if (ndvi < 0.25) return 'Vegetación escasa — buena visibilidad de afloramientos'
  if (ndvi < 0.4) return 'Vegetación moderada — visibilidad parcial'
  return 'Vegetación densa — detección difícil'
}

export function getSWIRBandDescription(band11: number, band12: number): string {
  const ratio = band11 / band12
  if (ratio > 1.6) return 'Firma de arcillas detectada (SWIR 1.6/2.2)'
  if (ratio > 1.2) return 'Firma de carbonatos detectada (absorción SWIR)'
  return 'Firma mixta sin carbonatos claros'
}

export async function downloadSatelliteImagery(
  latitude: number, longitude: number,
  onProgress?: (progress: number) => void,
): Promise<string> {
  onProgress?.(0)
  await new Promise(r => setTimeout(r, 300))
  onProgress?.(0.3)
  await new Promise(r => setTimeout(r, 300))
  onProgress?.(0.6)
  await new Promise(r => setTimeout(r, 200))
  onProgress?.(1)
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
}
