import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native'
import { COLORS } from '../types/constants'
import { getOfflineStatus, clearCache, exportAllData, downloadMapRegion, getCacheSize } from '../services/offlineManager'
import { syncNow, startAutoSync, onSyncStatus, isOnline } from '../services/syncService'
import { webSaveSamples } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { useCurrentLocation } from '../services/locationService'
import { isAuthenticated, getUser, logout as authLogout } from '../services/authService'

export function SettingsScreen({ navigation }: any) {
  const currentLocation = useCurrentLocation()
  const { samples, syncStatus, isOffline, setIsOffline, setAuth, setSamples } = useAppStore()
  const [cacheSize, setCacheSize] = useState({ total: 0, maps: 0, photos: 0 })
  const [lastMapDownload, setLastMapDownload] = useState<number | null>(null)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [pendingSamples, setPendingSamples] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadStatus()
    const unsub = onSyncStatus(status => {
      setSyncing(status.syncing)
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
    if (!currentLocation) {
      Alert.alert('Error', 'No hay ubicación disponible')
      return
    }
    setDownloading(true)
    try {
      await downloadMapRegion({
        latMin: currentLocation.latitude - 0.1,
        latMax: currentLocation.latitude + 0.1,
        lonMin: currentLocation.longitude - 0.1,
        lonMax: currentLocation.longitude + 0.1,
      })
      Alert.alert('Éxito', 'Mapas descargados para uso offline')
      loadStatus()
    } catch (err) {
      Alert.alert('Error', 'No se pudieron descargar los mapas')
    } finally {
      setDownloading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    await syncNow()
    loadStatus()
  }

  const handleClearAllSamples = () => {
    const doDelete = () => {
      webSaveSamples([])
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

  const handleClearSamplesWithoutPhotos = () => {
    const doDelete = () => {
      const removed = samples.filter(s => !s.photoUri?.length)
      if (removed.length === 0) {
        if (Platform.OS === 'web') {
          const info = samples.map((s,i) => `#${i+1} uris=${s.photoUri?.length??0}`).join('\n')
          window.alert(`Store: ${samples.length} muestras\nNinguna sin foto:\n${info}`)
        } else {
          Alert.alert('Sin cambios', 'No hay muestras sin foto')
        }
        return
      }
      const kept = samples.filter(s => s.photoUri?.length > 0)
      webSaveSamples(kept)
      setSamples(kept)
      if (Platform.OS === 'web') {
        const ids = kept.map(s => s.id.slice(-6)).join(', ')
        window.alert(`${removed.length} borradas, ${kept.length} quedan\nIDs: ${ids}`)
      } else {
        Alert.alert('Listo', `${removed.length} muestras sin foto fueron borradas`)
      }
    }
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar todas las muestras sin foto? No se puede deshacer.')) doDelete()
    } else {
      Alert.alert('Borrar muestras sin foto', '¿Eliminar todas las muestras sin foto?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: doDelete },
      ])
    }
  }

  const handleClearCache = () => {
    Alert.alert(
      'Limpiar caché',
      '¿Eliminar todos los datos almacenados? Las muestras no se borrarán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            await clearCache()
            loadStatus()
            Alert.alert('Listo', 'Caché limpiada')
          },
        },
      ],
    )
  }

  const handleExport = () => {
    if (samples.length === 0) {
      window.alert('No hay muestras para exportar')
      return
    }
    const json = JSON.stringify({
      exportDate: new Date().toISOString(),
      muestras: samples.map(s => ({
        codigo: s.notes?.match(/\[(.+?)\]/)?.[1] || s.id.slice(-8),
        tipo: s.estimatedRockType,
        lat: s.latitude,
        lon: s.longitude,
        fecha: new Date(s.timestamp).toLocaleDateString(),
        notas: s.notes,
        dimensiones: s.rockDimensions,
        estado: s.status,
      })),
      total: samples.length,
    }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `caliza_${Date.now()}.json`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
            <ActivityIndicator color="#fff" size="small" />
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
            Alert.alert('Cerrar sesión', '¿Cerrar sesión actual?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: async () => {
                await authLogout()
                setAuth(null, null)
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
              }},
            ])
          }}>
            <Text style={styles.dangerBtnText}>Cerrar sesión</Text>
          </TouchableOpacity>
        )}
      </View>

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
        <TouchableOpacity style={[styles.dangerBtn, { borderColor: COLORS.warning, marginTop: 8 }]} onPress={handleClearSamplesWithoutPhotos}>
          <Text style={[styles.dangerBtnText, { color: COLORS.warning }]}>Borrar muestras sin foto</Text>
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
