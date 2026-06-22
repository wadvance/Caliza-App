import { create } from 'zustand'
import { Sample, CalizaZone, GeologicalLayer, MLPrediction, AccessRoute } from '../types'
import { SyncStatus } from '../services/syncService'
import { COLORS } from '../types/constants'

interface AuthUser {
  id: string
  email: string
  full_name: string
  role: string
}

interface AppState {
  samples: Sample[]
  zones: CalizaZone[]
  layers: GeologicalLayer[]
  routes: AccessRoute[]
  selectedSample: Sample | null
  lastPrediction: MLPrediction | null
  isOffline: boolean
  syncStatus: SyncStatus
  isLoading: boolean
  authToken: string | null
  authUser: AuthUser | null

  setSamples: (samples: Sample[]) => void
  addSample: (sample: Sample) => void
  updateSample: (id: string, updates: Partial<Sample>) => void
  removeSample: (id: string) => void
  setZones: (zones: CalizaZone[]) => void
  addZone: (zone: CalizaZone) => void
  setRoutes: (routes: AccessRoute[]) => void
  addRoute: (route: AccessRoute) => void
  removeRoute: (id: string) => void
  setSelectedSample: (sample: Sample | null) => void
  setLastPrediction: (prediction: MLPrediction | null) => void
  setIsOffline: (offline: boolean) => void
  setSyncStatus: (status: SyncStatus) => void
  setLoading: (loading: boolean) => void
  toggleLayer: (layerId: string) => void
  setAuth: (token: string | null, user: AuthUser | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  samples: [],
  zones: [],
  layers: [
    { id: 'satellite', name: 'Satélite', type: 'satellite', coordinates: [], color: '#ffffff', opacity: 0.7, visible: false },
    { id: 'geological', name: 'Mapa geológico', type: 'geological_map', coordinates: [], color: COLORS.accent, opacity: 0.6, visible: true },
    { id: 'potential', name: 'Potencial caliza', type: 'caliza_potential', coordinates: [], color: COLORS.success, opacity: 0.5, visible: true },
    { id: 'extraction', name: 'Zonas de extracción', type: 'extraction_zone', coordinates: [], color: COLORS.warning, opacity: 0.5, visible: true },
    { id: 'samples', name: 'Puntos de muestreo', type: 'sample_point', coordinates: [], color: COLORS.highlight, opacity: 1, visible: true },
    { id: 'routes', name: 'Rutas de acceso', type: 'access_route', coordinates: [], color: '#3498db', opacity: 0.7, visible: false },
  ],
  routes: [],
  selectedSample: null,
  lastPrediction: null,
  isOffline: true,
  syncStatus: { syncing: false, progress: 0, total: 0, lastSync: null, error: null },
  isLoading: false,
  authToken: null,
  authUser: null,

  setSamples: (samples) => set({ samples }),
  addSample: (sample) => set((state) => ({ samples: [sample, ...state.samples] })),
  updateSample: (id, updates) => set((state) => ({
    samples: state.samples.map(s => s.id === id ? { ...s, ...updates } : s),
  })),
  removeSample: (id) => set((state) => ({
    samples: state.samples.filter(s => s.id !== id),
  })),
  setZones: (zones) => set({ zones }),
  addZone: (zone) => set((state) => ({ zones: [...state.zones, zone] })),
  setRoutes: (routes) => set({ routes }),
  addRoute: (route) => set((state) => ({ routes: [...state.routes, route] })),
  removeRoute: (id) => set((state) => ({ routes: state.routes.filter(r => r.id !== id) })),
  setSelectedSample: (sample) => set({ selectedSample: sample }),
  setLastPrediction: (prediction) => set({ lastPrediction: prediction }),
  setIsOffline: (offline) => set({ isOffline: offline }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setAuth: (token, user) => set({ authToken: token, authUser: user }),
  toggleLayer: (layerId) => set((state) => ({
    layers: state.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l),
  })),
}))
