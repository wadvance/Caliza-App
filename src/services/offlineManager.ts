import { Platform } from 'react-native'
import { setSetting, getSetting, getAllSamples, getAllZones } from './database'
import { getCurrentLocation } from './locationService'

const isWeb = Platform.OS === 'web'

let FileSystem: any = null
let CACHE_DIR = ''
let MAP_CACHE_DIR = ''
let SATELLITE_CACHE_DIR = ''
let PHOTO_CACHE_DIR = ''

async function initPaths() {
  if (isWeb) return
  try {
    FileSystem = require('expo-file-system')
    const docDir = FileSystem.documentDirectory || ''
    CACHE_DIR = `${docDir}cache/`
    MAP_CACHE_DIR = `${CACHE_DIR}maps/`
    SATELLITE_CACHE_DIR = `${CACHE_DIR}satellite/`
    PHOTO_CACHE_DIR = `${CACHE_DIR}photos/`
  } catch {
    FileSystem = null
  }
}

export async function initOfflineStorage(): Promise<void> {
  await initPaths()
  if (!FileSystem || isWeb) return

  const dirs = [CACHE_DIR, MAP_CACHE_DIR, SATELLITE_CACHE_DIR, PHOTO_CACHE_DIR]
  for (const dir of dirs) {
    try {
      const info = await FileSystem.getInfoAsync(dir)
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
      }
    } catch {}
  }
}

export async function getCacheSize(): Promise<{ total: number; maps: number; photos: number }> {
  if (isWeb) {
    return getWebCacheSize()
  }
  if (!FileSystem) return { total: 0, maps: 0, photos: 0 }

  const getDirSize = async (dir: string): Promise<number> => {
    try {
      const info = await FileSystem.getInfoAsync(dir)
      if (!info.exists) return 0
      const contents = await FileSystem.readDirectoryAsync(dir)
      let size = 0
      for (const file of contents) {
        const fileInfo = await FileSystem.getInfoAsync(`${dir}${file}`)
        if (fileInfo.exists) size += fileInfo.size || 0
      }
      return size
    } catch {
      return 0
    }
  }

  return {
    total: await getDirSize(CACHE_DIR),
    maps: await getDirSize(MAP_CACHE_DIR),
    photos: await getDirSize(PHOTO_CACHE_DIR),
  }
}

function getWebCacheSize(): { total: number; maps: number; photos: number } {
  let maps = 0; let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const size = localStorage.getItem(k)?.length ?? 0
      total += size
      if (k.startsWith('geocaliza_map_') || k.startsWith('geocaliza_tile_')) maps += size
    }
  } catch {}
  return { total, maps, photos: 0 }
}

export async function downloadMapRegion(
  region: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  zoomLevels: number[] = [10, 12, 14],
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (isWeb) {
    return downloadMapRegionWeb(region, zoomLevels, onProgress)
  }
  if (!FileSystem) return

  const totalTiles = zoomLevels.length * 100
  let completed = 0

  for (const zoom of zoomLevels) {
    const tilePath = `${MAP_CACHE_DIR}zoom_${zoom}_${region.latMin.toFixed(2)}_${region.lonMin.toFixed(2)}.json`
    const tileData = {
      region,
      zoom,
      timestamp: Date.now(),
      tiles: generateTileUrls(region, zoom),
    }
    await FileSystem.writeAsStringAsync(tilePath, JSON.stringify(tileData))
    completed += 100 / zoomLevels.length
    onProgress?.(completed / totalTiles)
  }

  await setSetting('last_map_download', Date.now().toString())
  await setSetting('map_download_region', JSON.stringify(region))
}

async function downloadMapRegionWeb(
  region: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  zoomLevels: number[],
  onProgress?: (progress: number) => void,
): Promise<void> {
  const prefix = `geocaliza_map_`
  let totalFetched = 0
  let totalTiles = 0
  for (const z of zoomLevels) {
    const { xMin, xMax, yMin, yMax } = tileBounds(region, z)
    totalTiles += (xMax - xMin + 1) * (yMax - yMin + 1)
  }

  for (let i = 0; i < zoomLevels.length; i++) {
    const zoom = zoomLevels[i]
    const { xMin, xMax, yMin, yMax } = tileBounds(region, zoom)
    const urls: string[] = []

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`)
      }
    }

    for (const url of urls) {
      try {
        await fetchAndCacheTile(url)
      } catch {}
      totalFetched++
      onProgress?.(totalFetched / totalTiles)
    }

    const metaKey = `${prefix}zoom_${zoom}_${region.latMin.toFixed(2)}_${region.lonMin.toFixed(2)}`
    const data = { region, zoom, timestamp: Date.now(), tiles: urls }
    try { localStorage.setItem(metaKey, JSON.stringify(data)) } catch {}
  }
  await setSetting('last_map_download', Date.now().toString())
  await setSetting('map_download_region', JSON.stringify(region))
}

async function fetchAndCacheTile(url: string): Promise<void> {
  if (typeof caches !== 'undefined') {
    const cache = await caches.open('geocaliza-map-tiles')
    const cached = await cache.match(url)
    if (cached) return
    try {
      const resp = await fetch(url)
      if (resp.ok) await cache.put(url, resp.clone())
    } catch {}
  } else {
    try {
      const resp = await fetch(url)
      if (!resp.ok) return
      const blob = await resp.blob()
      const reader = new FileReader()
      const b64 = await new Promise<string>(resolve => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      const key = `geocaliza_tile_${url.replace(/[^a-z0-9]/g, '_')}`
      localStorage.setItem(key, b64)
    } catch {}
  }
  preloadTileImage(url)
}

function preloadTileImage(url: string): void {
  try {
    const img = new Image()
    img.src = url
  } catch {}
}

function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const latRad = lat * Math.PI / 180
  const x = Math.floor((lon + 180) / 360 * n)
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

function tileBounds(
  region: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  zoom: number,
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const nw = latLonToTile(region.latMax, region.lonMin, zoom)
  const se = latLonToTile(region.latMin, region.lonMax, zoom)
  return {
    xMin: Math.min(nw.x, se.x),
    xMax: Math.max(nw.x, se.x),
    yMin: Math.min(nw.y, se.y),
    yMax: Math.max(nw.y, se.y),
  }
}

export async function hasMapRegion(region: { latMin: number; latMax: number; lonMin: number; lonMax: number }): Promise<boolean> {
  if (isWeb) {
    const prefix = `geocaliza_map_`
    const key = `${prefix}zoom_10_${region.latMin.toFixed(2)}_${region.lonMin.toFixed(2)}`
    try { return localStorage.getItem(key) !== null } catch { return false }
  }
  if (!FileSystem) return false
  try {
    const files = await FileSystem.readDirectoryAsync(MAP_CACHE_DIR)
    return files.some(f =>
      f.includes(region.latMin.toFixed(2)) && f.includes(region.lonMin.toFixed(2)),
    )
  } catch {
    return false
  }
}

export async function getLastDownloadTimestamp(): Promise<number | null> {
  const val = await getSetting('last_map_download')
  return val ? parseInt(val, 10) : null
}

export async function cachePhoto(uri: string): Promise<string> {
  if (!FileSystem || isWeb) return uri
  const filename = `photo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`
  const dest = `${PHOTO_CACHE_DIR}${filename}`
  await FileSystem.copyAsync({ from: uri, to: dest })
  return dest
}

export async function syncOfflinePhotos(): Promise<void> {
  if (!FileSystem || isWeb) return
  const samples = await getAllSamples()
  for (const sample of samples) {
    for (const photoUri of sample.photoUri) {
      if (photoUri.startsWith('file://')) {
        await cachePhoto(photoUri)
      }
    }
  }
}

export async function clearCache(): Promise<void> {
  if (isWeb) {
    try {
      Object.keys(localStorage).forEach(k => {
        if (!k.startsWith('caliza_')) localStorage.removeItem(k)
      })
    } catch {}
    try { caches.delete('geocaliza-map-tiles') } catch {}
    return
  }
  if (!FileSystem) return
  await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
  await initOfflineStorage()
}

export async function exportAllData(): Promise<string> {
  if (!FileSystem || isWeb) return ''

  const samples = await getAllSamples()
  const zones = await getAllZones()
  const exportData = {
    exportDate: Date.now(),
    samples,
    zones,
    metadata: {
      appVersion: '1.0.0',
      totalSamples: samples.length,
      totalZones: zones.length,
    },
  }

  const exportPath = `${FileSystem.documentDirectory}export_${Date.now()}.json`
  await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(exportData, null, 2))
  return exportPath
}

export async function getOfflineStatus(): Promise<{
  mapsDownloaded: boolean
  lastSync: number | null
  pendingSamples: number
  cacheSize: number
  lastMapDownload: number | null
}> {
  const cacheSize = await getCacheSize()
  const lastSyncStr = await getSetting('last_sync')
  const lastMapDownloadStr = await getSetting('last_map_download')
  const loadedSamples = await getAllSamples()
  const pendingSamples = loadedSamples.filter(s => !s.synced).length

  return {
    mapsDownloaded: false,
    lastSync: lastSyncStr ? parseInt(lastSyncStr, 10) : null,
    pendingSamples,
    cacheSize: cacheSize.total,
    lastMapDownload: lastMapDownloadStr ? parseInt(lastMapDownloadStr, 10) : null,
  }
}
