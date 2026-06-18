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
  if (!FileSystem || isWeb) return { total: 0, maps: 0, photos: 0 }

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

export async function downloadMapRegion(
  region: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  zoomLevels: number[] = [10, 12, 14],
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (!FileSystem || isWeb) return

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

function generateTileUrls(
  region: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  zoom: number,
): string[] {
  const urls: string[] = []
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      urls.push(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`)
    }
  }
  return urls.slice(0, 25)
}

export async function hasMapRegion(region: { latMin: number; latMax: number; lonMin: number; lonMax: number }): Promise<boolean> {
  if (!FileSystem || isWeb) return false
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
      Object.keys(localStorage).forEach(k => { if (!k.startsWith('caliza_')) localStorage.removeItem(k) })
    } catch {}
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
