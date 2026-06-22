const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export interface LocationContext {
  place: string
  road: string
  city: string
  state: string
  country: string
  nearby: NearbyFeature[]
}

export interface NearbyFeature {
  type: 'rio' | 'montaña' | 'carretera' | 'bosque' | 'lago' | 'playa' | 'pueblo'
  name: string
  distance: number
}

let lastRequest = 0

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now()
  const wait = Math.max(0, 1100 - (now - lastRequest))
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequest = Date.now()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getLocationContext(lat: number, lng: number): Promise<LocationContext> {
  const [geoData, overpassData] = await Promise.all([
    reverseGeocode(lat, lng),
    queryNearbyFeatures(lat, lng),
  ])
  return { ...geoData, nearby: overpassData }
}

async function reverseGeocode(lat: number, lng: number): Promise<Omit<LocationContext, 'nearby'>> {
  try {
    const data = await rateLimitedFetch(
      `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=es&zoom=16`
    )
    const address = data.address || {}
    return {
      place: data.display_name?.split(',')[0] || '',
      road: address.road || address.pedestrian || address.path || address.street || '',
      city: address.city || address.town || address.village || address.hamlet || address.municipality || '',
      state: address.state || '',
      country: address.country || '',
    }
  } catch {
    return { place: '', road: '', city: '', state: '', country: '' }
  }
}

async function queryNearbyFeatures(lat: number, lng: number): Promise<NearbyFeature[]> {
  try {
    const query = `[out:json][timeout:10];
    (
      node["natural"="peak"](around:2000,${lat},${lng});
      node["natural"="water"](around:1000,${lat},${lng});
      node["natural"="beach"](around:2000,${lat},${lng});
      way["natural"="water"](around:1000,${lat},${lng});
      way["waterway"="river"](around:1500,${lat},${lng});
      way["waterway"="stream"](around:1000,${lat},${lng});
      way["highway"="primary"](around:500,${lat},${lng});
      way["highway"="secondary"](around:500,${lat},${lng});
      way["highway"="tertiary"](around:500,${lat},${lng});
      way["highway"="track"](around:500,${lat},${lng});
      way["landuse"="forest"](around:1000,${lat},${lng});
      way["natural"="wood"](around:1000,${lat},${lng});
      way["natural"="scrub"](around:1000,${lat},${lng});
      rel["admin_level"="8"](around:1500,${lat},${lng});
      node["place"="village"](around:2000,${lat},${lng});
      node["place"="hamlet"](around:2000,${lat},${lng});
      node["place"="town"](around:3000,${lat},${lng});
    );
    out center tags 5;`

    const data = await rateLimitedFetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`)
    const elements = data.elements || []
    const results: NearbyFeature[] = []
    const seen = new Set<string>()

    for (const el of elements) {
      const tags = el.tags || {}
      const name = tags.name || tags['name:es'] || ''
      const elLat = el.lat ?? el.center?.lat ?? lat
      const elLng = el.lon ?? el.center?.lon ?? lng
      const dist = haversineKm(lat, lng, elLat, elLng)

      const key = `${el.type}-${el.id}`
      if (seen.has(key)) continue
      seen.add(key)

      let type: NearbyFeature['type'] | null = null
      if (el.type === 'node' && tags.natural === 'peak') type = 'montaña'
      else if (tags.natural === 'beach') type = 'playa'
      else if (tags.natural === 'water' || tags.waterway === 'river' || tags.waterway === 'stream' || tags.water === 'lake' || tags.water === 'reservoir') type = 'rio'
      else if (tags.highway && (tags.highway === 'primary' || tags.highway === 'secondary' || tags.highway === 'tertiary' || tags.highway === 'track')) type = 'carretera'
      else if (tags.landuse === 'forest' || tags.natural === 'wood' || tags.natural === 'scrub') type = 'bosque'
      else if (tags.place === 'town' || tags.place === 'village' || tags.place === 'hamlet' || (el.type === 'relation' && tags.admin_level === '8')) type = 'pueblo'

      if (!type) continue
      if (type === 'carretera' && name && results.some(r => r.type === 'carretera' && r.name === name)) continue
      if (type === 'bosque' && !name && results.some(r => r.type === 'bosque')) continue

      results.push({
        type,
        name: name || (type === 'carretera' ? 'Camino' : type === 'bosque' ? 'Bosque' : type === 'rio' ? 'Cuerpo de agua' : type),
        distance: Math.round(dist * 1000),
      })
    }

    results.sort((a, b) => a.distance - b.distance)
    return results.slice(0, 6)
  } catch {
    return []
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
