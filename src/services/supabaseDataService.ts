import supabase from './supabaseClient'
import { Sample, CalizaZone, FieldObservation, MLPrediction } from '../types'

// --- Samples ---
export async function supabaseGetSamples(userId?: string): Promise<Sample[]> {
  let query = supabase.from('samples').select('*').order('created_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(mapSupabaseSample)
}

export async function supabaseGetSample(id: string): Promise<Sample | null> {
  const { data, error } = await supabase.from('samples').select('*').eq('id', id).single()
  if (error) return null
  return mapSupabaseSample(data)
}

export async function supabaseSaveSample(sample: Partial<Sample> & { user_id: string }): Promise<Sample | null> {
  const payload = {
    user_id: sample.user_id,
    photo_urls: sample.photoUri || [],
    latitude: sample.latitude,
    longitude: sample.longitude,
    altitude: sample.altitude || 0,
    operator_name: sample.operatorName || '',
    notes: sample.notes || '',
    estimated_rock_type: sample.estimatedRockType || 'desconocido',
    acid_reaction: sample.quickTestResult?.acidReaction || null,
    hardness: sample.quickTestResult?.hardness || null,
    color: sample.quickTestResult?.color || null,
    texture: sample.quickTestResult?.texture || null,
    stratification: sample.quickTestResult?.stratification || null,
    fossil_presence: sample.quickTestResult?.fossilPresence || false,
    estimated_caco3: sample.quickTestResult?.estimatedCaCO3 || null,
    confidence_level: sample.confidenceLevel || 0,
    status: sample.status || 'pendiente',
  }
  const { data, error } = await supabase.from('samples').insert(payload).select().single()
  if (error) throw error
  return data ? mapSupabaseSample(data) : null
}

export async function supabaseUpdateSampleStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('samples').update({ status }).eq('id', id)
  if (error) throw error
}

export async function supabaseGetNearby(lat: number, lng: number, radiusKm = 5): Promise<Sample[]> {
  const { data, error } = await supabase.rpc('get_nearby_samples', {
    lat, lng, radius_km: radiusKm,
  })
  if (error) throw error
  return (data || []).map(mapSupabaseSample)
}

function mapSupabaseSample(row: any): Sample {
  return {
    id: row.id,
    photoUri: row.photo_urls || [],
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude || 0,
    operatorName: row.operator_name || '',
    timestamp: new Date(row.created_at || row.timestamp).getTime(),
    notes: row.notes || '',
    estimatedRockType: row.estimated_rock_type || 'desconocido',
    quickTestResult: row.acid_reaction ? {
      acidReaction: row.acid_reaction,
      hardness: row.hardness,
      color: row.color,
      texture: row.texture,
      stratification: row.stratification,
      fossilPresence: row.fossil_presence || false,
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
      date: row.lab_date ? new Date(row.lab_date).getTime() : Date.now(),
      laboratoryName: row.lab_name || '',
    } : undefined,
    confidenceLevel: row.confidence_level || 0,
    status: row.status || 'pendiente',
    synced: true,
  }
}

// --- Zones ---
export async function supabaseGetZones(): Promise<CalizaZone[]> {
  const { data, error } = await supabase.from('caliza_zones').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((z: any) => ({
    id: z.id,
    coordinates: z.coordinates || [],
    probability: z.probability || 'pendiente',
    confidence: z.confidence || 0,
    source: z.source || 'field',
  }))
}

// --- Observations ---
export async function supabaseSaveObservation(obs: Partial<FieldObservation> & { user_id: string }): Promise<void> {
  const { error } = await supabase.from('field_observations').insert({
    user_id: obs.user_id,
    type: obs.type || 'outcrop',
    description: obs.description || '',
    photos: obs.photos || [],
    latitude: obs.location?.latitude || 0,
    longitude: obs.location?.longitude || 0,
  })
  if (error) throw error
}

// --- Sync ---
export async function supabaseSyncBatch(samples: any[]): Promise<{ synced: number; errors: string[] }> {
  const { data, error } = await supabase.from('samples').upsert(
    samples.map(s => ({
      id: s.id,
      user_id: s.user_id,
      latitude: s.latitude,
      longitude: s.longitude,
      estimated_rock_type: s.estimated_rock_type,
      confidence_level: s.confidence_level,
      status: s.status || 'pendiente',
      synced: true,
    })),
    { onConflict: 'id' }
  )
  if (error) return { synced: 0, errors: [error.message] }
  return { synced: samples.length, errors: [] }
}

// --- Photos (Storage) ---
export async function supabaseUploadPhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri)
  const blob = await response.blob()
  const ext = uri.split('.').pop() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('caliza-photos').upload(path, blob, {
    contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
  })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('caliza-photos').getPublicUrl(path)
  return urlData.publicUrl
}
