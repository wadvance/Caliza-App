export const COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  accent: '#0f3460',
  highlight: '#e94560',
  success: '#2ecc71',
  warning: '#f39c12',
  danger: '#e74c3c',
  background: '#0f0f23',
  surface: '#1a1a2e',
  surfaceLight: '#242444',
  text: '#ffffff',
  textSecondary: '#a0a0b0',
  textMuted: '#606080',
  border: '#2a2a4a',

  probabilityHigh: '#2ecc71',
  probabilityMedium: '#f39c12',
  probabilityLow: '#e74c3c',
  probabilityPending: '#3498db',

  rockCaliza: '#d4c5a9',
  rockDolomita: '#c8b8a0',
  rockArcilla: '#8b7355',
  rockYeso: '#e8e0d0',
  rockGranito: '#7f8c8d',
  rockBasalto: '#2c3e50',
  rockMarga: '#b8a88a',
  rockTravertino: '#f0e8d0',
  rockCaliche: '#d0c8b0',
}

export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#242444' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0b0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f3460' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#606080' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#16213e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#16213e' }] },
]

export const ACID_REACTION_LABELS: Record<string, string> = {
  vigorosa: 'Alta efervescencia (CaCO₃ puro)',
  moderada: 'Efervescencia media (caliza dolomítica)',
  leve: 'Leve efervescencia (dolomita)',
  nula: 'Sin reacción (no calcáreo)',
}

export const ROCK_TYPES = [
  { id: 'caliza', label: 'Caliza', color: '#d4c5a9' },
  { id: 'dolomita', label: 'Dolomita', color: '#c8b8a0' },
  { id: 'arcilla', label: 'Arcilla', color: '#8b7355' },
  { id: 'yeso', label: 'Yeso', color: '#e8e0d0' },
  { id: 'granito', label: 'Granito', color: '#7f8c8d' },
  { id: 'basalto', label: 'Basalto', color: '#2c3e50' },
  { id: 'marga', label: 'Marga', color: '#b8a88a' },
  { id: 'travertino', label: 'Travertino', color: '#f0e8d0' },
  { id: 'caliche', label: 'Caliche', color: '#d0c8b0' },
]

export const SAMPLE_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente de validación',
  validado: 'Validado',
  descartado: 'Descartado',
}

export const SWIR_BANDS = {
  sentinel2: { band11: 1610, band12: 2190 },
  landsat8: { band6: 1600, band7: 2200 },
}

export const DETECTION_FEATURES = [
  'color',
  'textura',
  'granulometría',
  'fracturas',
  'vetas',
  'estratificación',
  'fósiles',
  'porosidad',
]

export const STORAGE_KEYS = {
  SAMPLES: 'caliza_samples',
  ZONES: 'caliza_zones',
  OBSERVATIONS: 'caliza_observations',
  SYNC_QUEUE: 'caliza_sync_queue',
  MAP_CACHE: 'caliza_map_cache',
  SETTINGS: 'caliza_settings',
  ML_MODEL: 'caliza_ml_model',
  SATELLITE_CACHE: 'caliza_satellite_cache',
}
