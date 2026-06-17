export interface Sample {
  id: string
  photoUri: string[]
  latitude: number
  longitude: number
  altitude: number
  operatorName: string
  timestamp: number
  notes: string
  estimatedRockType: RockType
  quickTestResult?: QuickTestResult
  labResult?: LabResult
  confidenceLevel: number
  status: SampleStatus
  synced: boolean
}

export type RockType =
  | 'caliza'
  | 'dolomita'
  | 'arcilla'
  | 'yeso'
  | 'granito'
  | 'basalto'
  | 'marga'
  | 'travertino'
  | 'caliche'
  | 'desconocido'

export interface QuickTestResult {
  acidReaction: AcidReaction
  hardness: number
  color: string
  texture: string
  stratification: string
  fossilPresence: boolean
  estimatedCaCO3?: number
}

export type AcidReaction = 'vigorosa' | 'moderada' | 'leve' | 'nula'

export interface LabResult {
  caco3Purity: number
  mgo: number
  sio2: number
  al2o3: number
  fe2o3: number
  loi: number
  moisture: number
  date: number
  laboratoryName: string
}

export type SampleStatus = 'pendiente' | 'validado' | 'descartado'

export interface GeologicalLayer {
  id: string
  name: string
  type: LayerType
  coordinates: { latitude: number; longitude: number }[]
  color: string
  opacity: number
  visible: boolean
}

export type LayerType =
  | 'geological_map'
  | 'extraction_zone'
  | 'topographic'
  | 'satellite'
  | 'caliza_potential'
  | 'access_route'
  | 'sample_point'
  | 'mining_concession'
  | 'vegetation_index'

export interface CalizaZone {
  id: string
  coordinates: { latitude: number; longitude: number }[]
  probability: ProbabilityLevel
  confidence: number
  source: string
  estimatedRockType?: string
}

export type ProbabilityLevel = 'alta' | 'media' | 'baja' | 'pendiente'

export interface SatelliteAnalysis {
  id: string
  location: { latitude: number; longitude: number }
  date: number
  source: 'sentinel2' | 'landsat8' | 'aster' | 'drone'
  ndvi: number
  clayRatio: number
  carbonateIndex: number
  quartzIndex: number
  zones: CalizaZone[]
  swirBands?: { band11: number; band12: number; band6: number; band7: number }
  elevation?: number
}

export interface FieldObservation {
  id: string
  type: 'outcrop' | 'boulder' | 'quarry' | 'road_cut' | 'river_bed'
  description: string
  photos: string[]
  location: { latitude: number; longitude: number }
  timestamp: number
}

export interface MLPrediction {
  className: string
  probability: number
  allProbabilities: Record<string, number>
  dominantFeatures: string[]
  recommendations: string[]
}

export interface SyncQueueItem {
  id: string
  type: 'sample' | 'observation' | 'photo'
  action: 'create' | 'update' | 'delete'
  data: unknown
  timestamp: number
  retries: number
}

export interface ExplorationReport {
  id: string
  title: string
  generatedAt: number
  author: string
  dateRange: { start: number; end: number }
  samples: Sample[]
  zones: CalizaZone[]
  statistics: ReportStatistics
}

export interface ReportStatistics {
  totalSamples: number
  validatedSamples: number
  highProbabilityZones: number
  averageConfidence: number
  dominantRockType: RockType
  areaCoveredKm2: number
}
