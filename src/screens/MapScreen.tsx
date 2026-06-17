import { useState, useEffect, useCallback } from 'react'
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList, TextInput, Dimensions } from 'react-native'
import MapView, { Marker, Polygon } from '../components/MapViewWrapper'
import { useAppStore } from '../store/useAppStore'
import { COLORS } from '../types/constants'
import { LayerToggle } from '../components/LayerToggle'
import { useCurrentLocation } from '../services/locationService'
import { getAllZones, getAllSamples } from '../services/database'
import { Sample, CalizaZone } from '../types'

const { height } = Dimensions.get('window')

interface District {
  id: string
  name: string
  lat: number
  lng: number
}

interface Province {
  id: string
  name: string
  lat: number
  lng: number
  districts: District[]
}

const PANAMA: Province[] = [
  {
    id: 'bocas-del-toro', name: 'Bocas del Toro', lat: 9.3403, lng: -82.2420,
    districts: [
      { id: 'bocas-del-toro-d', name: 'Bocas del Toro', lat: 9.3333, lng: -82.2500 },
      { id: 'changuinola', name: 'Changuinola', lat: 9.4167, lng: -82.5167 },
      { id: 'chiriqui-grande', name: 'Chiriquí Grande', lat: 9.2833, lng: -82.1167 },
    ],
  },
  {
    id: 'cocle', name: 'Coclé', lat: 8.4580, lng: -80.4400,
    districts: [
      { id: 'aguadulce', name: 'Aguadulce', lat: 8.2417, lng: -80.5406 },
      { id: 'anton', name: 'Antón', lat: 8.4000, lng: -80.2667 },
      { id: 'la-pintada', name: 'La Pintada', lat: 8.5833, lng: -80.5500 },
      { id: 'nata', name: 'Natá', lat: 8.3333, lng: -80.5167 },
      { id: 'ola', name: 'Olá', lat: 8.4167, lng: -80.6500 },
      { id: 'penonome', name: 'Penonomé', lat: 8.5167, lng: -80.3500 },
    ],
  },
  {
    id: 'colon', name: 'Colón', lat: 9.3546, lng: -79.9000,
    districts: [
      { id: 'colon-d', name: 'Colón', lat: 9.3590, lng: -79.9014 },
      { id: 'chagres', name: 'Chagres', lat: 9.2167, lng: -80.0000 },
      { id: 'donoso', name: 'Donoso', lat: 9.1333, lng: -80.3333 },
      { id: 'portobelo', name: 'Portobelo', lat: 9.5500, lng: -79.6500 },
      { id: 'santa-isabel', name: 'Santa Isabel', lat: 9.5167, lng: -79.1667 },
      { id: 'omar-torrijos', name: 'Omar Torrijos H.', lat: 8.8833, lng: -80.6333 },
    ],
  },
  {
    id: 'chiriqui', name: 'Chiriquí', lat: 8.4333, lng: -82.3333,
    districts: [
      { id: 'alanje', name: 'Alanje', lat: 8.4000, lng: -82.5667 },
      { id: 'baru', name: 'Barú', lat: 8.2833, lng: -82.8667 },
      { id: 'boqueron', name: 'Boquerón', lat: 8.5000, lng: -82.5667 },
      { id: 'boquete', name: 'Boquete', lat: 8.7833, lng: -82.4333 },
      { id: 'bugaba', name: 'Bugaba', lat: 8.4833, lng: -82.6167 },
      { id: 'david', name: 'David', lat: 8.4333, lng: -82.4333 },
      { id: 'dolega', name: 'Dolega', lat: 8.6333, lng: -82.4167 },
      { id: 'gualaca', name: 'Gualaca', lat: 8.5333, lng: -82.3000 },
      { id: 'remedios', name: 'Remedios', lat: 8.2333, lng: -81.8333 },
      { id: 'san-felix', name: 'San Félix', lat: 8.3000, lng: -81.8667 },
      { id: 'san-lorenzo', name: 'San Lorenzo', lat: 8.4000, lng: -82.1333 },
      { id: 'tierras-altas', name: 'Tierras Altas', lat: 8.9167, lng: -82.6000 },
      { id: 'tole', name: 'Tolé', lat: 8.2500, lng: -81.6667 },
    ],
  },
  {
    id: 'darien', name: 'Darién', lat: 8.1000, lng: -77.5333,
    districts: [
      { id: 'chepigana', name: 'Chepigana', lat: 8.4833, lng: -78.1000 },
      { id: 'pinogana', name: 'Pinogana', lat: 8.1167, lng: -77.6833 },
      { id: 'santa-fe-darien', name: 'Santa Fe', lat: 8.5000, lng: -78.1333 },
    ],
  },
  {
    id: 'herrera', name: 'Herrera', lat: 7.8333, lng: -80.6667,
    districts: [
      { id: 'chitre', name: 'Chitré', lat: 7.9667, lng: -80.4333 },
      { id: 'las-minas', name: 'Las Minas', lat: 7.8000, lng: -80.7500 },
      { id: 'los-pozos', name: 'Los Pozos', lat: 7.7833, lng: -80.6333 },
      { id: 'ocu', name: 'Ocú', lat: 7.9500, lng: -80.7833 },
      { id: 'parita', name: 'Parita', lat: 7.9833, lng: -80.5167 },
      { id: 'pese', name: 'Pesé', lat: 7.9000, lng: -80.6167 },
      { id: 'santa-maria', name: 'Santa María', lat: 8.1167, lng: -80.6667 },
    ],
  },
  {
    id: 'los-santos', name: 'Los Santos', lat: 7.6000, lng: -80.3667,
    districts: [
      { id: 'guarare', name: 'Guararé', lat: 7.8167, lng: -80.2833 },
      { id: 'las-tablas', name: 'Las Tablas', lat: 7.7667, lng: -80.2833 },
      { id: 'los-santos-d', name: 'Los Santos', lat: 7.9333, lng: -80.4167 },
      { id: 'macaracas', name: 'Macaracas', lat: 7.7333, lng: -80.5500 },
      { id: 'pedasi', name: 'Pedasí', lat: 7.5300, lng: -80.0167 },
      { id: 'pocri', name: 'Pocrí', lat: 7.6500, lng: -80.1167 },
      { id: 'tonosi', name: 'Tonosí', lat: 7.4167, lng: -80.4333 },
    ],
  },
  {
    id: 'panama', name: 'Panamá', lat: 9.0000, lng: -79.5000,
    districts: [
      { id: 'balboa', name: 'Balboa', lat: 8.9500, lng: -79.5667 },
      { id: 'chepo', name: 'Chepo', lat: 9.1667, lng: -79.1000 },
      { id: 'chiman', name: 'Chimán', lat: 8.7167, lng: -78.6333 },
      { id: 'panama-d', name: 'Panamá', lat: 9.0000, lng: -79.5000 },
      { id: 'san-miguelito', name: 'San Miguelito', lat: 9.0333, lng: -79.5000 },
      { id: 'taboga', name: 'Taboga', lat: 8.8000, lng: -79.5500 },
    ],
  },
  {
    id: 'panama-oeste', name: 'Panamá Oeste', lat: 8.8833, lng: -79.7833,
    districts: [
      { id: 'arraijan', name: 'Arraiján', lat: 8.9500, lng: -79.6500 },
      { id: 'capira', name: 'Capira', lat: 8.7500, lng: -79.8833 },
      { id: 'chame', name: 'Chame', lat: 8.5833, lng: -79.8833 },
      { id: 'la-chorrera', name: 'La Chorrera', lat: 8.8833, lng: -79.7833 },
      { id: 'san-carlos', name: 'San Carlos', lat: 8.4833, lng: -79.9500 },
    ],
  },
  {
    id: 'veraguas', name: 'Veraguas', lat: 8.1000, lng: -81.0000,
    districts: [
      { id: 'atalaya', name: 'Atalaya', lat: 8.0500, lng: -80.9333 },
      { id: 'calobre', name: 'Calobre', lat: 8.3167, lng: -80.8333 },
      { id: 'canazas', name: 'Cañazas', lat: 8.3167, lng: -81.2167 },
      { id: 'la-mesa', name: 'La Mesa', lat: 8.1500, lng: -81.1833 },
      { id: 'las-palmas', name: 'Las Palmas', lat: 8.1333, lng: -81.4500 },
      { id: 'mariato', name: 'Mariato', lat: 7.6000, lng: -80.8833 },
      { id: 'montijo', name: 'Montijo', lat: 7.9833, lng: -81.0667 },
      { id: 'rio-de-jesus', name: 'Río de Jesús', lat: 8.0833, lng: -81.1667 },
      { id: 'san-francisco', name: 'San Francisco', lat: 8.0500, lng: -81.3667 },
      { id: 'santa-fe-veraguas', name: 'Santa Fe', lat: 8.5000, lng: -81.0833 },
      { id: 'santiago', name: 'Santiago', lat: 8.1083, lng: -80.9722 },
      { id: 'sona', name: 'Soná', lat: 8.0167, lng: -81.3167 },
    ],
  },
  {
    id: 'guna-yala', name: 'Guna Yala', lat: 9.0667, lng: -78.0000,
    districts: [
      { id: 'guna-yala-d', name: 'Guna Yala', lat: 9.0667, lng: -78.0000 },
    ],
  },
  {
    id: 'embera', name: 'Emberá', lat: 8.5000, lng: -77.7000,
    districts: [
      { id: 'cemaco', name: 'Cémaco', lat: 8.1000, lng: -77.5333 },
      { id: 'sambu', name: 'Sambú', lat: 8.0167, lng: -78.2000 },
    ],
  },
  {
    id: 'ngabe-bugle', name: 'Ngäbe-Buglé', lat: 8.5000, lng: -81.5000,
    districts: [
      { id: 'besiko', name: 'Besikó', lat: 8.6000, lng: -81.8000 },
      { id: 'jirondai', name: 'Jirondai', lat: 8.9000, lng: -81.8000 },
      { id: 'kankintu', name: 'Kankintú', lat: 8.8333, lng: -81.7667 },
      { id: 'kusapin', name: 'Kusapín', lat: 9.2000, lng: -81.9000 },
      { id: 'mirono', name: 'Mironó', lat: 8.5000, lng: -81.6000 },
      { id: 'muna', name: 'Müna', lat: 8.4333, lng: -81.6333 },
      { id: 'nole-duima', name: 'Nole Duima', lat: 8.4500, lng: -81.9000 },
      { id: 'nurum', name: 'Ñürüm', lat: 8.4500, lng: -81.7833 },
      { id: 'calovebora', name: 'Santa Catalina/Calovébora', lat: 8.8333, lng: -81.0667 },
    ],
  },
]

export function MapScreen({ navigation }: any) {
  const currentLocation = useCurrentLocation()
  const { layers, toggleLayer, setSamples, setZones } = useAppStore()
  const [showLayers, setShowLayers] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null)
  const [targetRegion, setTargetRegion] = useState<any>(null)
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

  const filteredProvinces = searchText.trim()
    ? PANAMA.filter(p => p.name.toLowerCase().includes(searchText.trim().toLowerCase()))
    : PANAMA

  const filteredDistricts = searchText.trim() && selectedProvince
    ? selectedProvince.districts.filter(d => d.name.toLowerCase().includes(searchText.trim().toLowerCase()))
    : selectedProvince?.districts || []

  const handleSelectProvince = (province: Province) => {
    if (province.districts.length === 1) {
      setTargetRegion({ latitude: province.districts[0].lat, longitude: province.districts[0].lng, latitudeDelta: 0.25, longitudeDelta: 0.25 })
      setShowSearch(false)
      setSelectedProvince(null)
      setSearchText('')
    } else {
      setSelectedProvince(province)
      setSearchText('')
    }
  }

  const handleSelectDistrict = (district: District) => {
    setTargetRegion({ latitude: district.lat, longitude: district.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 })
    setShowSearch(false)
    setSelectedProvince(null)
    setSearchText('')
  }

  const handleBack = () => {
    setSelectedProvince(null)
    setSearchText('')
  }

  const handleCloseSearch = () => {
    setShowSearch(false)
    setSelectedProvince(null)
    setSearchText('')
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>🗺️ GeoCaliza</Text>
        <View style={styles.topBarRight}>
          {zones.length > 0 && showPotentialZones && (
            <View style={styles.zoneLegend}>
              <Text style={styles.legendTitle}>Probabilidad</Text>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityHigh }]} />
                <Text style={styles.legendLabel}>Alta</Text>
                <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityMedium }]} />
                <Text style={styles.legendLabel}>Media</Text>
                <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityLow }]} />
                <Text style={styles.legendLabel}>Baja</Text>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.searchBtn} onPress={() => setShowSearch(true)}>
            <Text style={styles.searchBtnText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.layerBtn} onPress={() => setShowLayers(true)}>
            <Text style={styles.layerBtnText}>⊞ Capas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView style={styles.map} initialRegion={targetRegion || {
        latitude: currentLocation?.latitude || 8.9824,
        longitude: currentLocation?.longitude || -79.5199,
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      }}>
        {showPotentialZones && zones.map(zone => (
          <Polygon key={zone.id} coordinates={zone.coordinates}
            fillColor={zone.probability === 'alta' ? COLORS.probabilityHigh + '40' :
                       zone.probability === 'media' ? COLORS.probabilityMedium + '35' :
                       COLORS.probabilityLow + '30'}
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
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Camara', { screen: 'RegisterSample' })}>
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

      {/* Search modal: province -> district drill-down */}
      <Modal visible={showSearch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: height * 0.75 }]}>
            <Text style={styles.modalTitle}>
              {selectedProvince ? `Distritos de ${selectedProvince.name}` : 'Buscar provincia'}
            </Text>
            {selectedProvince && (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backBtnText}>← Volver a provincias</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.searchInput}
              placeholder={selectedProvince ? 'Buscar distrito...' : 'Ej: Chiriquí, David, Penonomé...'}
              placeholderTextColor={COLORS.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />

            {!selectedProvince ? (
              <FlatList
                data={filteredProvinces}
                keyExtractor={item => item.id}
                style={styles.provinceList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.provinceRow} onPress={() => handleSelectProvince(item)}>
                    <Text style={styles.provinceName}>{item.name}</Text>
                    <Text style={styles.provinceBadge}>{item.districts.length} distritos</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <FlatList
                data={filteredDistricts}
                keyExtractor={item => item.id}
                style={styles.provinceList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.provinceRow} onPress={() => handleSelectDistrict(item)}>
                    <Text style={styles.provinceName}>{item.name}</Text>
                    <Text style={styles.provinceCoords}>{item.lat.toFixed(2)}, {item.lng.toFixed(2)}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={handleCloseSearch}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneLegend: {
    backgroundColor: COLORS.surfaceLight + 'E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendTitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: COLORS.textSecondary, fontSize: 10 },
  brand: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  searchBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.highlight, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { fontSize: 16 },
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
  backBtn: { marginBottom: 8 },
  backBtnText: { color: COLORS.highlight, fontSize: 14, fontWeight: '600' },
  searchInput: { backgroundColor: COLORS.surfaceLight, borderRadius: 10, padding: 12, color: COLORS.text, fontSize: 15, marginBottom: 12 },
  provinceList: { maxHeight: height * 0.4 },
  provinceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  provinceName: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  provinceCoords: { color: COLORS.textMuted, fontSize: 12 },
  provinceBadge: { color: COLORS.accent, fontSize: 11, fontWeight: '600' },
  closeBtn: { backgroundColor: COLORS.accent, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  closeBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
})
