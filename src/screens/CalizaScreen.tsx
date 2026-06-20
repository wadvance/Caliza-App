import { useState, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapView, { Polygon, Marker } from '../components/MapViewWrapper'
import { COLORS } from '../types/constants'
import { useCurrentLocation } from '../services/locationService'
import { getAllZones } from '../services/database'
import { CalizaZone } from '../types'
import { useAppStore } from '../store/useAppStore'

export function CalizaScreen() {
  const currentLocation = useCurrentLocation()
  const { zones, setZones } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const mapRef = useRef<any>(null)

  useMemo(() => {
    if (zones.length === 0) {
      setLoading(true)
      getAllZones().then(z => { setZones(z); setLoading(false) })
    }
  }, [])

  const getColor = (p: string) => {
    switch (p) {
      case 'alta': return COLORS.probabilityHigh
      case 'media': return COLORS.probabilityMedium
      case 'baja': return COLORS.probabilityLow
      default: return COLORS.probabilityPending
    }
  }

  const centerOnZone = (zone: CalizaZone) => {
    setSelectedZoneId(zone.id)
    const lats = zone.coordinates.map(c => c.latitude)
    const lngs = zone.coordinates.map(c => c.longitude)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const midLat = (minLat + maxLat) / 2
    const midLng = (minLng + maxLng) / 2
    const latDelta = (maxLat - minLat) * 1.8 || 0.05
    const lngDelta = (maxLng - minLng) * 1.8 || 0.05
    if (mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion({ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }, 600)
    }
  }

  const zoneInfo: Record<string, { depth: string; type: string }> = {
    'chiriqui-david-cerro-pelado': { depth: '15–40 m', type: 'Caliza masiva cristalina' },
    'chiriqui-gualaca': { depth: '10–30 m', type: 'Caliza estratificada' },
    'chiriqui-bugaba': { depth: '8–25 m', type: 'Caliza arcillosa' },
    'chiriqui-boqueron': { depth: '5–20 m', type: 'Caliza margosa' },
    'chiriqui-dolega': { depth: '6–18 m', type: 'Caliza detrítica' },
    'chiriqui-alanje': { depth: '4–15 m', type: 'Caliza arenosa' },
    'chiriqui-tole': { depth: '3–10 m', type: 'Caliza lutítica' },
    'chiriqui-san-felix': { depth: '2–8 m', type: 'Caliza conglomerádica' },
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⛰️ Zonas de Caliza</Text>
      <Text style={styles.subtitle}>Potencial calcáreo en Chiriquí</Text>

      {currentLocation && (
        <View style={styles.coords}>
          <Text style={styles.coordsText}>
            {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.accent} size="large" style={{ marginTop: 40 }} />
      ) : zones.length === 0 ? (
        <Text style={styles.empty}>No hay zonas de caliza registradas</Text>
      ) : (
        <>
          <MapView ref={mapRef} style={styles.map}
            initialRegion={{
              latitude: 8.4500, longitude: -82.4000,
              latitudeDelta: 0.6, longitudeDelta: 0.6,
            }}
          >
            {zones.map(zone => (
              <Polygon key={zone.id} coordinates={zone.coordinates}
                fillColor={getColor(zone.probability) + '40'}
                strokeColor={selectedZoneId === zone.id ? '#fff' : getColor(zone.probability)}
                strokeWidth={selectedZoneId === zone.id ? 4 : 2}
              />
            ))}
          </MapView>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityHigh }]} />
            <Text style={styles.legendLabel}>Alta</Text>
            <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityMedium }]} />
            <Text style={styles.legendLabel}>Media</Text>
            <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityLow }]} />
            <Text style={styles.legendLabel}>Baja</Text>
          </View>

          <Text style={styles.sectionTitle}>Zonas identificadas</Text>
          {zones.map(zone => {
            const info = zoneInfo[zone.id]
            const isSelected = selectedZoneId === zone.id
            return (
              <TouchableOpacity key={zone.id} onPress={() => centerOnZone(zone)}
                style={[styles.zoneCard, { borderLeftColor: getColor(zone.probability), borderColor: isSelected ? getColor(zone.probability) : COLORS.border }]}
              >
                <Text style={styles.zoneTitle}>
                  Zona {zone.probability.charAt(0).toUpperCase() + zone.probability.slice(1)}
                </Text>
                {info ? (
                  <>
                    <Text style={styles.zoneDetail}>📏 Profundidad: {info.depth}</Text>
                    <Text style={styles.zoneDetail}>🪨 Tipo: {info.type}</Text>
                  </>
                ) : (
                  <Text style={styles.zoneDetail}>Confianza: {(zone.confidence * 100).toFixed(0)}%</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 30 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', padding: 16, paddingTop: 56, paddingBottom: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, paddingHorizontal: 16, marginBottom: 8 },
  coords: { backgroundColor: 'rgba(0,0,0,0.5)', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  coordsText: { color: '#fff', fontSize: 11, fontFamily: 'monospace' },
  empty: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginTop: 60 },
  map: { height: 200, marginHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: COLORS.textSecondary, fontSize: 12 },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  zoneCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, borderLeftWidth: 3, borderWidth: 1, borderColor: COLORS.border,
  },
  zoneTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  zoneDetail: { color: COLORS.textSecondary, fontSize: 13, marginVertical: 2 },
})
