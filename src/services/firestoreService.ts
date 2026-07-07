import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  GeoPoint,
  DocumentData,
  QueryConstraint,
  writeBatch,
} from 'firebase/firestore'
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage'
import {
  getAuth,
} from 'firebase/auth'
import { Sample, CalizaZone, FieldObservation } from '../types'

const db = getFirestore()
const storage = getStorage()
const auth = getAuth()

// --- Helpers ---
function sampleToFirestore(s: Partial<Sample> & { userId: string }): Record<string, any> {
  return {
    userId: s.userId,
    photoUrls: s.photoUri || [],
    latitude: s.latitude,
    longitude: s.longitude,
    altitude: s.altitude || 0,
    operatorName: s.operatorName || '',
    notes: s.notes || '',
    estimatedRockType: s.estimatedRockType || 'desconocido',
    acidReaction: s.quickTestResult?.acidReaction || null,
    hardness: s.quickTestResult?.hardness ?? null,
    color: s.quickTestResult?.color || null,
    texture: s.quickTestResult?.texture || null,
    stratification: s.quickTestResult?.stratification || null,
    fossilPresence: s.quickTestResult?.fossilPresence || false,
    estimatedCaco3: s.quickTestResult?.estimatedCaCO3 ?? null,
    labCaco3: s.labResult?.caco3Purity ?? null,
    labMgo: s.labResult?.mgo ?? null,
    labSio2: s.labResult?.sio2 ?? null,
    labAl2o3: s.labResult?.al2o3 ?? null,
    labFe2o3: s.labResult?.fe2o3 ?? null,
    labLoi: s.labResult?.loi ?? null,
    labMoisture: s.labResult?.moisture ?? null,
    labDate: s.labResult?.date ?? null,
    labName: s.labResult?.laboratoryName ?? null,
    confidenceLevel: s.confidenceLevel || 0,
    status: s.status || 'pendiente',
    synced: true,
    updatedAt: serverTimestamp(),
  }
}

function firestoreToSample(id: string, data: DocumentData): Sample {
  return {
    id,
    photoUri: data.photoUrls || [],
    latitude: data.latitude,
    longitude: data.longitude,
    altitude: data.altitude || 0,
    operatorName: data.operatorName || '',
    timestamp: data.createdAt instanceof Timestamp
      ? data.createdAt.toMillis()
      : data.timestamp || Date.now(),
    notes: data.notes || '',
    estimatedRockType: data.estimatedRockType || 'desconocido',
    quickTestResult: data.acidReaction ? {
      acidReaction: data.acidReaction,
      hardness: data.hardness,
      color: data.color,
      texture: data.texture,
      stratification: data.stratification,
      fossilPresence: data.fossilPresence || false,
      estimatedCaCO3: data.estimatedCaco3,
    } : undefined,
    labResult: data.labCaco3 ? {
      caco3Purity: data.labCaco3,
      mgo: data.labMgo,
      sio2: data.labSio2,
      al2o3: data.labAl2o3,
      fe2o3: data.labFe2o3,
      loi: data.labLoi,
      moisture: data.labMoisture,
      date: data.labDate instanceof Timestamp
        ? data.labDate.toMillis()
        : data.labDate || Date.now(),
      laboratoryName: data.labName || '',
    } : undefined,
    confidenceLevel: data.confidenceLevel || 0,
    status: data.status || 'pendiente',
    synced: true,
  }
}

// --- Samples ---
export async function firestoreGetSamples(userId?: string): Promise<Sample[]> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
  if (userId) constraints.unshift(where('userId', '==', userId))
  const q = query(collection(db, 'samples'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => firestoreToSample(d.id, d.data()))
}

export async function firestoreGetSample(id: string): Promise<Sample | null> {
  const ref = doc(db, 'samples', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return firestoreToSample(snap.id, snap.data())
}

export async function firestoreSaveSample(sample: Partial<Sample> & { userId: string }): Promise<Sample | null> {
  const data = sampleToFirestore(sample)
  if (sample.id) {
    const ref = doc(db, 'samples', sample.id)
    data.createdAt = serverTimestamp()
    await setDoc(ref, data)
    return firestoreToSample(sample.id, { ...data, createdAt: Timestamp.now() })
  } else {
    data.createdAt = serverTimestamp()
    const docRef = await addDoc(collection(db, 'samples'), data)
    return firestoreToSample(docRef.id, { ...data, createdAt: Timestamp.now() })
  }
}

export async function firestoreUpdateSampleStatus(id: string, status: string): Promise<void> {
  await updateDoc(doc(db, 'samples', id), { status, updatedAt: serverTimestamp() })
}

export async function firestoreGetNearby(lat: number, lng: number, radiusKm = 5): Promise<Sample[]> {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180))
  const q = query(
    collection(db, 'samples'),
    where('latitude', '>=', lat - latDelta),
    where('latitude', '<=', lat + latDelta),
    orderBy('latitude'),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map(d => firestoreToSample(d.id, d.data()))
    .filter(s => {
      const d = haversine(lat, lng, s.latitude, s.longitude)
      return d <= radiusKm
    })
    .slice(0, 100)
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// --- Zones ---
export async function firestoreGetZones(): Promise<CalizaZone[]> {
  const q = query(collection(db, 'calizaZones'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({
    id: d.id,
    coordinates: d.data().coordinates || [],
    probability: d.data().probability || 'pendiente',
    confidence: d.data().confidence || 0,
    source: d.data().source || 'field',
  }))
}

// --- Observations ---
export async function firestoreSaveObservation(obs: Partial<FieldObservation> & { userId: string }): Promise<void> {
  await addDoc(collection(db, 'fieldObservations'), {
    userId: obs.userId,
    type: obs.type || 'outcrop',
    description: obs.description || '',
    photos: obs.photos || [],
    latitude: obs.location?.latitude || 0,
    longitude: obs.location?.longitude || 0,
    createdAt: serverTimestamp(),
  })
}

// --- Sync batch ---
export async function firestoreSyncBatch(samples: any[]): Promise<{ synced: number; errors: string[] }> {
  const batch = writeBatch(db)
  let synced = 0
  const errors: string[] = []
  for (const s of samples) {
    try {
      const ref = doc(db, 'samples', s.id)
      batch.set(ref, {
        userId: s.userId,
        latitude: s.latitude,
        longitude: s.longitude,
        estimatedRockType: s.estimatedRockType,
        confidenceLevel: s.confidenceLevel,
        status: s.status || 'pendiente',
        synced: true,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      synced++
    } catch (e: any) {
      errors.push(e.message)
    }
  }
  await batch.commit()
  return { synced, errors }
}

// --- Photos (Firebase Storage) ---
export async function firestoreUploadPhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri)
  const blob = await response.blob()
  const ext = uri.split('.').pop() || 'jpg'
  const path = `photos/${userId}/${Date.now()}.${ext}`
  const storageRef = ref(storage, path)
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'
  await uploadBytes(storageRef, blob, { contentType })
  return await getDownloadURL(storageRef)
}
