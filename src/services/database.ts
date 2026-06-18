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

    CREATE TABLE IF NOT EXISTS sample_history (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT DEFAULT '',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_sample ON sample_history(sample_id, timestamp);
  `)
}

function webSaveSamples(samples: Sample[]): void {
  try { localStorage.setItem('caliza_samples', JSON.stringify(samples)) } catch {}
}

function webLoadSamples(): Sample[] {
  try {
    const data = localStorage.getItem('caliza_samples')
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

export async function saveSample(sample: Sample): Promise<void> {
  if (!db) {
    const samples = webLoadSamples()
    const idx = samples.findIndex(s => s.id === sample.id)
    if (idx >= 0) samples[idx] = sample
    else samples.unshift(sample)
    webSaveSamples(samples)
    return
  }
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
  if (!db) return webLoadSamples()
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

export interface HistoryEntry {
  id: string
  sampleId: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  timestamp: number
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export async function addSampleHistory(
  sampleId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy = '',
): Promise<void> {
  if (!db) return
  if (oldValue === newValue) return
  await db.runAsync(
    `INSERT INTO sample_history (id, sample_id, field, old_value, new_value, changed_by, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), sampleId, field, oldValue, newValue, changedBy, Date.now()],
  )
}

export async function getSampleHistory(sampleId: string): Promise<HistoryEntry[]> {
  if (!db) return []
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sample_history WHERE sample_id = ? ORDER BY timestamp DESC',
    [sampleId],
  )
  return rows.map(r => ({
    id: r.id,
    sampleId: r.sample_id,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    changedBy: r.changed_by,
    timestamp: r.timestamp,
  }))
}

export function formatFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    notes: 'Observaciones',
    estimated_rock_type: 'Tipo de roca',
    status: 'Estado',
    acid_reaction: 'Reacción HCl',
    hardness: 'Dureza',
    color: 'Color',
    texture: 'Textura',
    stratification: 'Estratificación',
    fossil_presence: 'Presencia de fósiles',
    estimated_caco3: 'CaCO₃ estimado',
    lab_caco3: 'CaCO₃ (lab)',
    lab_mgo: 'MgO (lab)',
    lab_sio2: 'SiO₂ (lab)',
    lab_al2o3: 'Al₂O₃ (lab)',
    lab_fe2o3: 'Fe₂O₃ (lab)',
    lab_loi: 'LOI (lab)',
    lab_moisture: 'Humedad (lab)',
    lab_name: 'Laboratorio',
    operator_name: 'Operador',
  }
  return labels[field] || field
}

export async function saveSampleWithHistory(
  sample: Sample,
  previousSample: Sample | null,
  changedBy = '',
): Promise<void> {
  await saveSample(sample)
  if (!previousSample) return

  const changes: [string, string | null, string | null][] = []
  if (sample.notes !== previousSample.notes) changes.push(['notes', previousSample.notes, sample.notes])
  if (sample.estimatedRockType !== previousSample.estimatedRockType) changes.push(['estimated_rock_type', previousSample.estimatedRockType, sample.estimatedRockType])
  if (sample.operatorName !== previousSample.operatorName) changes.push(['operator_name', previousSample.operatorName, sample.operatorName])
  if (sample.status !== previousSample.status) changes.push(['status', previousSample.status, sample.status])

  const q = sample.quickTestResult
  const pq = previousSample.quickTestResult
  if (q && pq) {
    if (q.acidReaction !== pq.acidReaction) changes.push(['acid_reaction', pq.acidReaction, q.acidReaction])
    if (q.hardness !== pq.hardness) changes.push(['hardness', String(pq.hardness), String(q.hardness)])
    if (q.color !== pq.color) changes.push(['color', pq.color, q.color])
    if (q.texture !== pq.texture) changes.push(['texture', pq.texture, q.texture])
    if (q.stratification !== pq.stratification) changes.push(['stratification', pq.stratification, q.stratification])
    if (q.fossilPresence !== pq.fossilPresence) changes.push(['fossil_presence', String(pq.fossilPresence), String(q.fossilPresence)])
    if (q.estimatedCaCO3 !== pq.estimatedCaCO3) changes.push(['estimated_caco3', String(pq.estimatedCaCO3 ?? ''), String(q.estimatedCaCO3 ?? '')])
  }

  const l = sample.labResult
  const pl = previousSample.labResult
  if (l && pl) {
    if (l.caco3Purity !== pl.caco3Purity) changes.push(['lab_caco3', String(pl.caco3Purity), String(l.caco3Purity)])
    if (l.mgo !== pl.mgo) changes.push(['lab_mgo', String(pl.mgo), String(l.mgo)])
    if (l.sio2 !== pl.sio2) changes.push(['lab_sio2', String(pl.sio2), String(l.sio2)])
    if (l.al2o3 !== pl.al2o3) changes.push(['lab_al2o3', String(pl.al2o3), String(l.al2o3)])
    if (l.fe2o3 !== pl.fe2o3) changes.push(['lab_fe2o3', String(pl.fe2o3), String(l.fe2o3)])
    if (l.loi !== pl.loi) changes.push(['lab_loi', String(pl.loi), String(l.loi)])
    if (l.moisture !== pl.moisture) changes.push(['lab_moisture', String(pl.moisture), String(l.moisture)])
    if (l.laboratoryName !== pl.laboratoryName) changes.push(['lab_name', pl.laboratoryName, l.laboratoryName])
  }

  for (const [field, oldVal, newVal] of changes) {
    await addSampleHistory(sample.id, field, oldVal, newVal, changedBy)
  }
}
