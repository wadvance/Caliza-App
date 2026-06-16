import { Platform } from 'react-native'
import { Sample, CalizaZone, FieldObservation, SyncQueueItem } from '../types'

const isWeb = Platform.OS === 'web'

let db: any = null

export async function initDatabase(): Promise<void> {
  if (isWeb) {
    console.log('SQLite not available on web, using in-memory storage')
    return
  }

  const SQLite = require('expo-sqlite')
  db = await SQLite.openDatabaseAsync('caliza_explorer.db')

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      photo_uris TEXT NOT NULL DEFAULT '[]',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL DEFAULT 0,
      operator_name TEXT DEFAULT '',
      timestamp INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      estimated_rock_type TEXT DEFAULT 'desconocido',
      acid_reaction TEXT,
      hardness REAL,
      color TEXT,
      texture TEXT,
      stratification TEXT,
      fossil_presence INTEGER DEFAULT 0,
      estimated_caco3 REAL,
      lab_caco3 REAL,
      lab_mgo REAL,
      lab_sio2 REAL,
      lab_al2o3 REAL,
      lab_fe2o3 REAL,
      lab_loi REAL,
      lab_moisture REAL,
      lab_date INTEGER,
      lab_name TEXT,
      confidence_level REAL DEFAULT 0,
      status TEXT DEFAULT 'pendiente',
      synced INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS caliza_zones (
      id TEXT PRIMARY KEY,
      coordinates TEXT NOT NULL,
      probability TEXT NOT NULL,
      confidence REAL DEFAULT 0,
      source TEXT DEFAULT 'field',
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS field_observations (
      id TEXT PRIMARY KEY,
      observation_type TEXT NOT NULL,
      description TEXT DEFAULT '',
      photos TEXT DEFAULT '[]',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      item_type TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      retries INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
    CREATE INDEX IF NOT EXISTS idx_samples_synced ON samples(synced);
    CREATE INDEX IF NOT EXISTS idx_zones_probability ON caliza_zones(probability);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp);
  `)
}

export async function saveSample(sample: Sample): Promise<void> {
  if (!db) return
  await db.runAsync(
    `INSERT OR REPLACE INTO samples
     (id, photo_uris, latitude, longitude, altitude, operator_name, timestamp,
      notes, estimated_rock_type, acid_reaction, hardness, color, texture,
      stratification, fossil_presence, estimated_caco3, lab_caco3, lab_mgo,
      lab_sio2, lab_al2o3, lab_fe2o3, lab_loi, lab_moisture, lab_date, lab_name,
      confidence_level, status, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sample.id,
      JSON.stringify(sample.photoUri),
      sample.latitude,
      sample.longitude,
      sample.altitude,
      sample.operatorName,
      sample.timestamp,
      sample.notes,
      sample.estimatedRockType,
      sample.quickTestResult?.acidReaction ?? null,
      sample.quickTestResult?.hardness ?? null,
      sample.quickTestResult?.color ?? null,
      sample.quickTestResult?.texture ?? null,
      sample.quickTestResult?.stratification ?? null,
      sample.quickTestResult?.fossilPresence ? 1 : 0,
      sample.quickTestResult?.estimatedCaCO3 ?? null,
      sample.labResult?.caco3Purity ?? null,
      sample.labResult?.mgo ?? null,
      sample.labResult?.sio2 ?? null,
      sample.labResult?.al2o3 ?? null,
      sample.labResult?.fe2o3 ?? null,
      sample.labResult?.loi ?? null,
      sample.labResult?.moisture ?? null,
      sample.labResult?.date ?? null,
      sample.labResult?.laboratoryName ?? null,
      sample.confidenceLevel,
      sample.status,
      sample.synced ? 1 : 0,
    ],
  )
}

export async function getAllSamples(): Promise<Sample[]> {
  if (!db) return []
  const rows = await db.getAllAsync<any>('SELECT * FROM samples ORDER BY timestamp DESC')
  return rows.map(mapRowToSample)
}

export async function getSampleById(id: string): Promise<Sample | null> {
  if (!db) return null
  const row = await db.getFirstAsync<any>('SELECT * FROM samples WHERE id = ?', [id])
  return row ? mapRowToSample(row) : null
}

export async function getPendingSyncSamples(): Promise<Sample[]> {
  if (!db) return []
  const rows = await db.getAllAsync<any>('SELECT * FROM samples WHERE synced = 0')
  return rows.map(mapRowToSample)
}

function mapRowToSample(row: any): Sample {
  return {
    id: row.id,
    photoUri: JSON.parse(row.photo_uris || '[]'),
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    operatorName: row.operator_name,
    timestamp: row.timestamp,
    notes: row.notes,
    estimatedRockType: row.estimated_rock_type,
    quickTestResult: row.acid_reaction ? {
      acidReaction: row.acid_reaction,
      hardness: row.hardness,
      color: row.color,
      texture: row.texture,
      stratification: row.stratification,
      fossilPresence: Boolean(row.fossil_presence),
      estimatedCaCO3: row.estimated_caco3,
    } : undefined,
    labResult: row.lab_caco3 ? {
      caco3Purity: row.lab_caco3,
      mgo: row.lab_mgo,
      sio2: row.lab_sio2,
      al2o3: row.lab_al2o3,
      fe2o3: row.lab_fe2o3,
      loi: row.lab_loi,
      moisture: row.lab_moisture,
      date: row.lab_date,
      laboratoryName: row.lab_name,
    } : undefined,
    confidenceLevel: row.confidence_level,
    status: row.status,
    synced: Boolean(row.synced),
  }
}

export async function saveZone(zone: CalizaZone): Promise<void> {
  if (!db) return
  await db.runAsync(
    `INSERT OR REPLACE INTO caliza_zones (id, coordinates, probability, confidence, source)
     VALUES (?, ?, ?, ?, ?)`,
    [zone.id, JSON.stringify(zone.coordinates), zone.probability, zone.confidence, zone.source],
  )
}

export async function getAllZones(): Promise<CalizaZone[]> {
  if (!db) return []
  const rows = await db.getAllAsync<any>('SELECT * FROM caliza_zones')
  return rows.map(row => ({
    id: row.id,
    coordinates: JSON.parse(row.coordinates),
    probability: row.probability,
    confidence: row.confidence,
    source: row.source,
  }))
}

export async function saveObservation(obs: FieldObservation): Promise<void> {
  if (!db) return
  await db.runAsync(
    `INSERT OR REPLACE INTO field_observations
     (id, observation_type, description, photos, latitude, longitude, timestamp, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [obs.id, obs.type, obs.description, JSON.stringify(obs.photos), obs.location.latitude,
     obs.location.longitude, obs.timestamp, 0],
  )
}

export async function getSetting(key: string): Promise<string | null> {
  if (!db) return null
  const row = await db.getFirstAsync<any>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!db) return
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  if (!db) return
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_queue (id, item_type, action, data, timestamp, retries)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [item.id, item.type, item.action, JSON.stringify(item.data), item.timestamp, item.retries],
  )
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  if (!db) return []
  const rows = await db.getAllAsync<any>('SELECT * FROM sync_queue ORDER BY timestamp ASC')
  return rows.map(row => ({
    id: row.id,
    type: row.item_type,
    action: row.action,
    data: JSON.parse(row.data),
    timestamp: row.timestamp,
    retries: row.retries,
  }))
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  if (!db) return
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id])
}

export async function clearSyncQueue(): Promise<void> {
  if (!db) return
  await db.execAsync('DELETE FROM sync_queue')
}

export async function getUnsyncedCount(): Promise<number> {
  if (!db) return 0
  const row = await db.getFirstAsync<any>('SELECT COUNT(*) as count FROM samples WHERE synced = 0')
  return row?.count ?? 0
}

export async function getSamplesByStatus(status: string): Promise<Sample[]> {
  if (!db) return []
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM samples WHERE status = ? ORDER BY timestamp DESC',
    [status],
  )
  return rows.map(mapRowToSample)
}

export async function getSamplesInRegion(
  latMin: number, latMax: number, lonMin: number, lonMax: number,
): Promise<Sample[]> {
  if (!db) return []
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM samples
     WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
     ORDER BY timestamp DESC`,
    [latMin, latMax, lonMin, lonMax],
  )
  return rows.map(mapRowToSample)
}

export async function exportDatabase(): Promise<string> {
  if (!db) return ''
  const dbPath = FileSystem.documentDirectory + 'SQLite/caliza_explorer.db'
  const exportPath = FileSystem.documentDirectory + `caliza_export_${Date.now()}.db`
  await FileSystem.copyAsync({ from: dbPath, to: exportPath })
  return exportPath
}
