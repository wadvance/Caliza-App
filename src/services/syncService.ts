import API_CONFIG, { getApiUrl, getAuthHeaders } from './api'
import { getToken, getAuthMode } from './authService'
import { getSyncQueue, removeFromSyncQueue, getAllSamples, saveSample } from './database'
import { firestoreGetSamples, firestoreSyncBatch, firestoreGetSample } from './firestoreService'
import { getAuth } from 'firebase/auth'
import { Sample } from '../types'

let _NetInfo: any = null
async function getNetInfo(): Promise<any> {
  if (_NetInfo) return _NetInfo
  try {
    const mod = require('@react-native-community/netinfo')
    _NetInfo = mod.default || mod
  } catch {
    _NetInfo = {
      fetch: async () => ({ isConnected: true }),
      addEventListener: () => () => {},
    }
  }
  return _NetInfo
}

type SyncStatusCallback = (status: SyncStatus) => void

export interface SyncStatus {
  syncing: boolean
  progress: number
  total: number
  lastSync: number | null
  error: string | null
}

let syncCallbacks: SyncStatusCallback[] = []
let currentStatus: SyncStatus = {
  syncing: false,
  progress: 0,
  total: 0,
  lastSync: null,
  error: null,
}

export function onSyncStatus(callback: SyncStatusCallback): () => void {
  syncCallbacks.push(callback)
  callback(currentStatus)
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback)
  }
}

function notifyStatus(): void {
  syncCallbacks.forEach(cb => cb(currentStatus))
}

export async function syncNow(): Promise<void> {
  const NetInfo = await getNetInfo()
  const netState = await NetInfo.fetch()
  if (!netState.isConnected) {
    currentStatus.error = 'Sin conexión a internet'
    notifyStatus()
    return
  }

  const token = getToken()
  if (!token) {
    currentStatus.error = 'No hay sesión activa'
    notifyStatus()
    return
  }

  currentStatus.syncing = true
  currentStatus.error = null
  notifyStatus()

  const mode = getAuthMode()

  try {
    if (mode === 'firebase') {
      await syncToFirebase()
    } else {
      await syncToMockServer(token)
    }
    currentStatus.lastSync = Date.now()
  } catch (err) {
    currentStatus.error = `Error de sincronización: ${err}`
  } finally {
    currentStatus.syncing = false
    notifyStatus()
  }
}

async function syncToFirebase(): Promise<void> {
  const user = getAuth().currentUser
  if (!user) {
    currentStatus.error = 'No hay sesión activa'
    return
  }
  const userId = user.uid

  const queue = await getSyncQueue()
  currentStatus.total = queue.length
  currentStatus.progress = 0
  notifyStatus()

  const unsyncedSamples = queue.filter(i => i.type === 'sample')

  if (unsyncedSamples.length > 0) {
    const batch = unsyncedSamples.map(i => ({
      ...i.data,
      userId,
    }))

    const result = await firestoreSyncBatch(batch)

    for (const item of unsyncedSamples) {
      await removeFromSyncQueue(item.id)
      currentStatus.progress++
      notifyStatus()
    }

    if (result.errors.length > 0) {
      currentStatus.error = result.errors.slice(0, 3).join('; ')
    }
  }

  const remoteSamples = await firestoreGetSamples(userId)
  const existing = await getAllSamples()

  for (const remote of remoteSamples) {
    if (!existing.find(s => s.id === remote.id)) {
      await saveSample({ ...remote, synced: true })
    }
  }
}

async function syncToMockServer(token: string): Promise<void> {
  const queue = await getSyncQueue()
  currentStatus.total = queue.length
  currentStatus.progress = 0
  notifyStatus()

  const unsyncedSamples = queue.filter(i => i.type === 'sample')

  if (unsyncedSamples.length > 0) {
    const batch = unsyncedSamples.map(i => i.data as any)
    const lastSync = currentStatus.lastSync
      ? new Date(currentStatus.lastSync).toISOString()
      : undefined

    const res = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SYNC), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        samples: batch,
        last_sync: lastSync,
      }),
    })

    if (res.ok) {
      const result = await res.json()
      for (const item of unsyncedSamples) {
        await removeFromSyncQueue(item.id)
        currentStatus.progress++
        notifyStatus()
      }
      if (result.errors?.length > 0) {
        currentStatus.error = result.errors.slice(0, 3).join('; ')
      }
    } else {
      throw new Error(`Error del servidor: ${res.status}`)
    }
  }

  const pendingRes = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SYNC_PENDING), {
    headers: getAuthHeaders(token),
  })
  if (pendingRes.ok) {
    const pendingData = await pendingRes.json()
    for (const remoteSample of pendingData.samples || []) {
      const existing = await getAllSamples()
      if (!existing.find(s => s.id === remoteSample.id)) {
        await saveSample({
          id: remoteSample.id,
          photoUri: remoteSample.photo_urls || [],
          latitude: remoteSample.latitude,
          longitude: remoteSample.longitude,
          altitude: remoteSample.altitude || 0,
          operatorName: remoteSample.operator_name || '',
          timestamp: new Date(remoteSample.timestamp).getTime(),
          notes: remoteSample.notes || '',
          estimatedRockType: remoteSample.estimated_rock_type || 'desconocido',
          confidenceLevel: remoteSample.confidence_level || 0,
          status: remoteSample.status || 'pendiente',
          synced: true,
        } as Sample)
      }
    }
  }
}

export async function syncSample(sample: Sample): Promise<boolean> {
  const mode = getAuthMode()

  if (mode === 'firebase') {
    try {
      const user = getAuth().currentUser
      if (!user) return false
      const result = await firestoreGetSample(sample.id)
      return result !== null
    } catch {
      return false
    }
  }

  const token = getToken()
  if (!token) return false

  try {
    const body = {
      latitude: sample.latitude,
      longitude: sample.longitude,
      altitude: sample.altitude,
      notes: sample.notes,
      operator_name: sample.operatorName,
      estimated_rock_type: sample.estimatedRockType,
      confidence_level: sample.confidenceLevel,
      status: sample.status,
    }

    const res = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SAMPLES), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

export function startAutoSync(intervalMs = 300000): () => void {
  const interval = setInterval(async () => {
    const NetInfo = await getNetInfo()
    const netState = await NetInfo.fetch()
    if (netState.isConnected && getToken()) {
      syncNow()
    }
  }, intervalMs)
  return () => clearInterval(interval)
}

export async function isOnline(): Promise<boolean> {
  const NetInfo = await getNetInfo()
  const netState = await NetInfo.fetch()
  return netState.isConnected ?? false
}

export async function onNetworkChange(callback: (connected: boolean) => void): Promise<() => void> {
  const NetInfo = await getNetInfo()
  return NetInfo.addEventListener(state => {
    callback(state.isConnected ?? false)
  })
}
