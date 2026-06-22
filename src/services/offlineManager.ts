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
    return await getWebCacheSize()
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

async function getWebCacheSize(): Promise<{ total: number; maps: number; photos: number }> {
  let maps = 0; let total = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const size = localStorage.getItem(k)?.length ?? 0
      total += size
      if (k.startsWith('geocaliza_map_')) maps += size
    }
  } catch {}
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('geocaliza-tiles-v1')
      const keys = await cache.keys()
      for (const req of keys) {
        const res = await cache.match(req)
        if (res) {
          const blob = await res.blob()
          const size = blob.size
          maps += size
          total += size
        }
      }
    } catch {}
  }
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
  const tileUrls: string[] = []
  for (const zoom of zoomLevels) {
    const xMin = lonToTileX(region.lonMin, zoom)
    const xMax = lonToTileX(region.lonMax, zoom)
    const yMin = latToTileY(region.latMax, zoom)
    const yMax = latToTileY(region.latMin, zoom)
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tileUrls.push(`https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`)
      }
    }
  }

  let completed = 0
  const total = tileUrls.length

  if (total === 0) {
    onProgress?.(1)
    return
  }

  const cache = typeof caches !== 'undefined' ? await caches.open('geocaliza-tiles-v1').catch(() => null) : null

  const batchSize = 8
  for (let i = 0; i < tileUrls.length; i += batchSize) {
    const batch = tileUrls.slice(i, i + batchSize)
    await Promise.all(batch.map(async (url) => {
      if (cache) {
        const existing = await cache.match(url)
        if (existing) { completed++; return }
      }
      try {
        const res = await fetch(url)
        if (res.ok && cache) {
          await cache.put(url, res.clone())
        }
        res.body?.cancel()
      } catch {}
      completed++
    }))
    onProgress?.(completed / total)
  }

  const prefix = `geocaliza_map_`
  const zoom = zoomLevels[0]
  const metaKey = `${prefix}zoom_${zoom}_${region.latMin.toFixed(2)}_${region.lonMin.toFixed(2)}`
  const data = { region, zoom, timestamp: Date.now(), tileCount: total }
  try { localStorage.setItem(metaKey, JSON.stringify(data)) } catch {}
  await setSetting('last_map_download', Date.now().toString())
  await setSetting('map_download_region', JSON.stringify(region))
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom))
}

function latToTileY(lat: number, zoom: number): number {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
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
        if (k.startsWith('geocaliza_map_') || k.startsWith('geocaliza_tile_')) localStorage.removeItem(k)
      })
    } catch {}
    if (typeof caches !== 'undefined') {
      try { await caches.delete('geocaliza-tiles-v1') } catch {}
    }
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
