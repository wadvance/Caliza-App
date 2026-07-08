import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native'
import { COLORS } from '../types/constants'
import { getOfflineStatus, clearCache, exportAllData, downloadMapRegion, getCacheSize } from '../services/offlineManager'
import { syncNow, startAutoSync, onSyncStatus, isOnline } from '../services/syncService'
import { clearAllSamples } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { useCurrentLocation, getCurrentLocation } from '../services/locationService'
import { isAuthenticated, getUser, logout as authLogout } from '../services/authService'

const isWeb = Platform.OS === 'web'

export function SettingsScreen({ navigation }: any) {
  const currentLocation = useCurrentLocation()
  const { samples, syncStatus, isOffline, setIsOffline, setAuth, setSamples, setSyncStatus } = useAppStore()
  const [cacheSize, setCacheSize] = useState({ total: 0, maps: 0, photos: 0 })
  const [lastMapDownload, setLastMapDownload] = useState<number | null>(null)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [pendingSamples, setPendingSamples] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)

  const installRef = useRef<any>(null)

  useEffect(() => {
    if (!isWeb) return
    const handler = (e: Event) => {
      e.preventDefault()
      installRef.current = e
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = () => {
    const prompt = installRef.current
    if (!prompt) return
    prompt.prompt()
    prompt.userChoice.then((result: any) => {
      if (result.outcome === 'accepted') setInstallPrompt(null)
    })
  }

  useEffect(() => {
    loadStatus()
    const unsub = onSyncStatus(status => {
      setSyncing(status.syncing)
      setSyncStatus(status)
    })
    checkConnectivity()
    return unsub
  }, [])

  const loadStatus = async () => {
    const status = await getOfflineStatus()
    const size = await getCacheSize()
    setCacheSize(size)
    setLastMapDownload(status.lastMapDownload)
    setLastSync(status.lastSync)
    setPendingSamples(status.pendingSamples)
  }

  const checkConnectivity = async () => {
    const online = await isOnline()
    setIsOffline(!online)
  }

  const handleDownloadMaps = async () => {
    let loc = currentLocation
    if (!loc) {
      try { loc = await getCurrentLocation() } catch {}
    }
    if (!loc) {
      Alert.alert('Error', 'No hay ubicación disponible. Activa el GPS o espera unos segundos.')
      return
    }
    const region = {
      latMin: loc.latitude - 0.1,
      latMax: loc.latitude + 0.1,
      lonMin: loc.longitude - 0.1,
      lonMax: loc.longitude + 0.1,
    }
    setDownloading(true)
    setDownloadProgress(0)
    try {
      await downloadMapRegion(region, [10, 12, 14], (p) => setDownloadProgress(p))
      loadStatus()
      if (Platform.OS === 'web') {
        if (window.confirm('Mapa del área guardado. ¿Abrir el mapa ahora?')) {
          navigation.navigate('Mapa', { screen: 'MapMain' } as any)
        }
      } else {
        Alert.alert('Éxito', 'Mapas descargados para uso offline')
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudieron descargar los mapas')
    } finally {
      setDownloading(false)
      setDownloadProgress(0)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    await syncNow()
    loadStatus()
    const { error, lastSync } = useAppStore.getState().syncStatus
    if (error) {
      if (Platform.OS === 'web') window.alert(error)
      else Alert.alert('Error de sincronización', error)
    } else if (lastSync) {
      if (Platform.OS === 'web') window.alert('Sincronización completada')
      else Alert.alert('Sincronización', 'Completada exitosamente')
    }
  }

  const handleClearAllSamples = () => {
    const doDelete = async () => {
      await clearAllSamples()
      setSamples([])
      if (Platform.OS === 'web') window.alert('Todas las muestras fueron borradas')
      else Alert.alert('Listo', 'Todas las muestras fueron borradas')
    }
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar TODAS las muestras? No se puede deshacer.')) doDelete()
    } else {
      Alert.alert('Borrar todas las muestras', '¿Eliminar todas las muestras?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: doDelete },
      ])
    }
  }

  const handleClearCache = () => {
    const doClean = async () => {
      await clearCache()
      loadStatus()
      if (Platform.OS === 'web') window.alert('Caché limpiada')
      else Alert.alert('Listo', 'Caché limpiada')
    }
    if (Platform.OS === 'web') {
      if (window.confirm('¿Limpiar caché? Las muestras no se borrarán.')) doClean()
    } else {
      Alert.alert('Limpiar caché', '¿Eliminar todos los datos almacenados?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpiar', style: 'destructive', onPress: doClean },
      ])
    }
  }

  const handleExport = () => {
    if (samples.length === 0) {
      if (isWeb) window.alert('No hay muestras para exportar')
      else Alert.alert('Error', 'No hay muestras para exportar')
      return
    }
    const line = (k: string, v: any) => `${k}: ${v}`
    const rows = samples.map((s, i) => {
      const codigo = s.notes?.match(/\[(.+?)\]/)?.[1] || s.id.slice(-8)
      return `--- Muestra ${i + 1} ---\n${line('Código', codigo)}\n${line('Tipo', s.estimatedRockType)}\n${line('Lat', s.latitude.toFixed(6))}\n${line('Lon', s.longitude.toFixed(6))}\n${line('Estado', s.status)}\n${line('Notas', s.notes || '-')}`
    })
    const text = `Exportación: ${new Date().toLocaleString()}\nTotal: ${samples.length} muestras\n\n${rows.join('\n\n')}`
    if (isWeb) {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          window.alert(`${samples.length} muestras copiadas al portapapeles`)
        }).catch(() => {
          const w = window.open('', '_blank')
          if (w) { w.document.write(`<pre>${text}</pre>`); w.document.close() }
        })
      } else {
        const w = window.open('', '_blank')
        if (w) { w.document.write(`<pre>${text}</pre>`); w.document.close() }
      }
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (ts: number | null) => {
    if (!ts) return 'Nunca'
    return new Date(ts).toLocaleString()
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Configuración</Text>

      <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('RegisterSample')}>
        <Text style={styles.navBtnText}>+ Registrar muestra</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado offline</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Conexión</Text>
          <View style={[styles.statusDot, { backgroundColor: isOffline ? COLORS.danger : COLORS.success }]} />
          <Text style={[styles.statusValue, { color: isOffline ? COLORS.danger : COLORS.success }]}>
            {isOffline ? 'Sin conexión' : 'Conectado'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Última sincronización</Text>
          <Text style={styles.statusValue}>{formatDate(lastSync)}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Muestras pendientes</Text>
          <Text style={styles.statusValue}>{pendingSamples}</Text>
        </View>
        {syncStatus.error && (
          <Text style={styles.errorText}>{syncStatus.error}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mapas offline</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Última descarga</Text>
          <Text style={styles.statusValue}>{formatDate(lastMapDownload)}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Caché de mapas</Text>
          <Text style={styles.statusValue}>{formatBytes(cacheSize.maps)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, downloading && styles.disabledBtn]}
          onPress={handleDownloadMaps}
          disabled={downloading}
        >
          {downloading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.actionBtnText}>{Math.round(downloadProgress * 100)}%</Text>
            </View>
          ) : (
            <Text style={styles.actionBtnText}>Descargar mapas del área</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sesión</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Estado</Text>
          <Text style={[styles.statusValue, { color: isAuthenticated() ? COLORS.success : COLORS.warning }]}>
            {isAuthenticated() ? `Conectado como ${getUser()?.email || ''}` : 'Sin cuenta'}
          </Text>
        </View>
        {isAuthenticated() && (
          <TouchableOpacity style={styles.dangerBtn} onPress={() => {
            const doLogout = async () => {
              await authLogout()
              setAuth(null, null)
              navigation.getParent()?.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] })
            }
            if (isWeb) {
              if (window.confirm('¿Cerrar sesión actual?')) doLogout()
            } else {
              Alert.alert('Cerrar sesión', '¿Cerrar sesión actual?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: doLogout },
              ])
            }
          }}>
            <Text style={styles.dangerBtnText}>Cerrar sesión</Text>
          </TouchableOpacity>
        )}
      </View>

      {isWeb && installPrompt && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={handleInstall}>
            <Text style={styles.actionBtnText}>📲 Instalar aplicación</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sincronización</Text>
        <TouchableOpacity
          style={[styles.actionBtn, syncing && styles.disabledBtn]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <View style={styles.syncProgress}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.actionBtnText}>
                {syncStatus.progress}/{syncStatus.total}
              </Text>
            </View>
          ) : (
            <Text style={styles.actionBtnText}>Sincronizar ahora</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Almacenamiento</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Caché total</Text>
          <Text style={styles.statusValue}>{formatBytes(cacheSize.total)}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Fotos</Text>
          <Text style={styles.statusValue}>{formatBytes(cacheSize.photos)}</Text>
        </View>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleClearCache}>
          <Text style={styles.dangerBtnText}>Limpiar caché</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerBtn, { borderColor: COLORS.danger }]} onPress={handleClearAllSamples}>
          <Text style={styles.dangerBtnText}>Borrar TODAS las muestras</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Guía</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('WorkflowGuide')}>
          <Text style={styles.actionBtnText}>📖 Flujo de trabajo en campo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleExport}>
          <Text style={styles.actionBtnText}>Exportar todos los datos</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', padding: 16, paddingTop: 20 },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  navBtn: {
    backgroundColor: COLORS.highlight,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  navBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusLabel: { color: COLORS.textSecondary, fontSize: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 'auto', marginRight: 8 },
  statusValue: { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 8 },
  actionBtn: {
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledBtn: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  syncProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dangerBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  dangerBtnText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },
})
