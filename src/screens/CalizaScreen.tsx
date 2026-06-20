import { useState, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapView, { Polygon, Marker } from '../components/MapViewWrapper'
import { COLORS } from '../types/constants'
import { useCurrentLocation } from '../services/locationService'
import { getAllZones } from '../services/database'
import { CalizaZone } from '../types'
import { useAppStore } from '../store/useAppStore'

const PROB_LEVELS = ['alta', 'media', 'baja'] as const
const PROB_LABELS: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
const PROB_COLORS: Record<string, string> = { alta: COLORS.probabilityHigh, media: COLORS.probabilityMedium, baja: COLORS.probabilityLow }

export function CalizaScreen() {
  const currentLocation = useCurrentLocation()
  const { zones, setZones } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const mapRef = useRef<any>(null)

  useMemo(() => {
    if (zones.length === 0) {
      setLoading(true)
      getAllZones().then(z => { setZones(z); setLoading(false) })
    }
  }, [])

  const toggleIdx = (idx: number) => {
    const next = selectedIdx === idx ? null : idx
    setSelectedIdx(next)
    if (next === null) {
      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion({ latitude: 8.4500, longitude: -82.4000, latitudeDelta: 0.6, longitudeDelta: 0.6 }, 600)
      }
      return
    }
    const prob = PROB_LEVELS[next]
    const matched = zones.filter(z => z.probability === prob)
    if (matched.length === 0) return
    const allLats = matched.flatMap(z => z.coordinates.map(c => c.latitude))
    const allLngs = matched.flatMap(z => z.coordinates.map(c => c.longitude))
    const minLat = Math.min(...allLats), maxLat = Math.max(...allLats)
    const minLng = Math.min(...allLngs), maxLng = Math.max(...allLngs)
    const midLat = (minLat + maxLat) / 2
    const midLng = (minLng + maxLng) / 2
    const latDelta = (maxLat - minLat) * 1.8 || 0.1
    const lngDelta = (maxLng - minLng) * 1.8 || 0.1
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
            {zones.map(zone => {
              const zi = PROB_LEVELS.indexOf(zone.probability as typeof PROB_LEVELS[number])
              const isHighlighted = selectedIdx !== null && zi === selectedIdx
              return (
                <Polygon key={zone.id} coordinates={zone.coordinates}
                  fillColor={PROB_COLORS[zone.probability] + '40'}
                  strokeColor={isHighlighted ? '#fff' : PROB_COLORS[zone.probability]}
                  strokeWidth={isHighlighted ? 4 : 2}
                />
              )
            })}
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
          {PROB_LEVELS.map((prob, idx) => {
            const probZones = zones.filter(z => z.probability === prob)
            if (probZones.length === 0) return null
            const isSelected = selectedIdx === idx
            const color = PROB_COLORS[prob]
            return (
              <TouchableOpacity key={prob} onPress={() => toggleIdx(idx)}
                style={[styles.zoneCard, {
                  borderLeftColor: isSelected ? color : COLORS.border,
                  borderColor: isSelected ? color : COLORS.border,
                  backgroundColor: isSelected ? color + '18' : COLORS.surface,
                }]}
              >
                <View style={styles.titleRow}>
                  <Text style={[styles.zoneTitle, isSelected && { color }]}>Zona {PROB_LABELS[prob]}</Text>
                  <Text style={[styles.selectionBadge, isSelected && { color: '#fff', backgroundColor: color }]}>
                    {isSelected ? '✓' : ''}
                  </Text>
                </View>
                {probZones.map(zone => {
                  const info = zoneInfo[zone.id]
                  return (
                    <View key={zone.id} style={styles.zoneItem}>
                      <Text style={styles.zoneName}>{zone.id.replace('chiriqui-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
                      <Text style={styles.zoneDebug}>prob={zone.probability}</Text>
                      {info ? (
                        <Text style={styles.zoneDetail}>📏 {info.depth} · 🪨 {info.type}</Text>
                      ) : (
                        <Text style={styles.zoneDetail}>Confianza: {(zone.confidence * 100).toFixed(0)}%</Text>
                      )}
                    </View>
                  )
                })}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  selectionBadge: { fontSize: 14, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  zoneTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  zoneItem: { marginBottom: 8, paddingLeft: 4 },
  zoneName: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  zoneDebug: { color: '#888', fontSize: 10, fontFamily: 'monospace', marginBottom: 2 },
  zoneDetail: { color: COLORS.textSecondary, fontSize: 13, marginVertical: 1 },
})
