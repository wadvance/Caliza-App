import { useState, useEffect, useCallback } from 'react'
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList } from 'react-native'
import MapView, { Marker, Polygon } from '../components/MapViewWrapper'
import { useAppStore } from '../store/useAppStore'
import { COLORS } from '../types/constants'
import { LayerToggle } from '../components/LayerToggle'
import { useCurrentLocation } from '../services/locationService'
import { getAllZones, getAllSamples } from '../services/database'
import { Sample, CalizaZone } from '../types'

export function MapScreen({ navigation }: any) {
  const currentLocation = useCurrentLocation()
  const { layers, toggleLayer, setSamples, setZones } = useAppStore()
  const [showLayers, setShowLayers] = useState(false)
  const [samples, setLocalSamples] = useState<Sample[]>([])
  const [zones, setLocalZones] = useState<CalizaZone[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [loadedSamples, loadedZones] = await Promise.all([getAllSamples(), getAllZones()])
    setLocalSamples(loadedSamples)
    setLocalZones(loadedZones)
    setSamples(loadedSamples)
    setZones(loadedZones)
  }

  const getZoneColor = (probability: string) => {
    switch (probability) {
      case 'alta': return COLORS.probabilityHigh
      case 'media': return COLORS.probabilityMedium
      case 'baja': return COLORS.probabilityLow
      default: return COLORS.probabilityPending
    }
  }

  const visibleLayers = layers.filter(l => l.visible)
  const showPotentialZones = visibleLayers.some(l => l.id === 'potential')
  const showSamplePoints = visibleLayers.some(l => l.id === 'samples')

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>🗺️ GeoCaliza</Text>
        <TouchableOpacity style={styles.layerBtn} onPress={() => setShowLayers(true)}>
          <Text style={styles.layerBtnText}>⊞ Capas</Text>
        </TouchableOpacity>
      </View>

      <MapView style={styles.map} initialRegion={{
        latitude: currentLocation?.latitude || 19.4326,
        longitude: currentLocation?.longitude || -99.1332,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}>
        {showPotentialZones && zones.map(zone => (
          <Polygon key={zone.id} coordinates={zone.coordinates}
            fillColor={getZoneColor(zone.probability) + '4D'}
            strokeColor={getZoneColor(zone.probability)} strokeWidth={2}
          />
        ))}
        {showSamplePoints && samples.map(sample => (
          <Marker key={sample.id}
            coordinate={{ latitude: sample.latitude, longitude: sample.longitude }}
            pinColor={sample.status === 'validado' ? COLORS.success : sample.status === 'descartado' ? COLORS.danger : COLORS.warning}
          />
        ))}
      </MapView>

      <View style={styles.overlay}>
        {currentLocation && (
          <View style={styles.coords}>
            <Text style={styles.coordsText}>
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Camara', { screen: 'CameraMain' })}>
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Escanear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Camara', { screen: 'CameraMain' })}>
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>Registrar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Muestras', { screen: 'SampleListMain' })}>
          <Text style={styles.actionIcon}>📍</Text>
          <Text style={styles.actionLabel}>Muestras</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Más', { screen: 'Satellite' })}>
          <Text style={styles.actionIcon}>🛰️</Text>
          <Text style={styles.actionLabel}>Satélite</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showLayers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Capas del mapa</Text>
            <FlatList data={layers} keyExtractor={item => item.id}
              renderItem={({ item }) => <LayerToggle layer={item} onToggle={toggleLayer} />}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLayers(false)}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: COLORS.surface + 'E6',
  },
  brand: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  layerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceLight },
  layerBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  map: { flex: 1 },
  overlay: { position: 'absolute', top: 100, left: 16, right: 16, alignItems: 'center' },
  coords: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  coordsText: { color: '#fff', fontSize: 11, fontFamily: 'monospace' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingBottom: 30,
    backgroundColor: COLORS.surface + 'E6',
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  actionBtn: { alignItems: 'center', paddingHorizontal: 16 },
  actionIcon: { fontSize: 24 },
  actionLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  closeBtn: { backgroundColor: COLORS.accent, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  closeBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
})
