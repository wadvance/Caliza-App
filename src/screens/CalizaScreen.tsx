import { useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapView, { Polygon, Marker } from '../components/MapViewWrapper'
import { COLORS } from '../types/constants'
import { useCurrentLocation } from '../services/locationService'
import { CalizaZone } from '../types'

const PROB_LEVELS = ['alta', 'media', 'baja'] as const
const PROB_LABELS: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }
const PROB_COLORS: Record<string, string> = { alta: COLORS.probabilityHigh, media: COLORS.probabilityMedium, baja: COLORS.probabilityLow }

const ZONES: CalizaZone[] = [
  { id: 'chiriqui-david-cerro-pelado', probability: 'alta', confidence: 0.82, source: 'geological_map', coordinates: [{ latitude: 8.4600, longitude: -82.4600 }, { latitude: 8.4600, longitude: -82.4000 }, { latitude: 8.4000, longitude: -82.4000 }, { latitude: 8.4000, longitude: -82.4600 }] },
  { id: 'chiriqui-gualaca', probability: 'alta', confidence: 0.78, source: 'geological_map', coordinates: [{ latitude: 8.5600, longitude: -82.3300 }, { latitude: 8.5600, longitude: -82.2700 }, { latitude: 8.5000, longitude: -82.2700 }, { latitude: 8.5000, longitude: -82.3300 }] },
  { id: 'chiriqui-bugaba', probability: 'media', confidence: 0.65, source: 'geological_map', coordinates: [{ latitude: 8.5100, longitude: -82.6500 }, { latitude: 8.5100, longitude: -82.5800 }, { latitude: 8.4500, longitude: -82.5800 }, { latitude: 8.4500, longitude: -82.6500 }] },
  { id: 'chiriqui-boqueron', probability: 'media', confidence: 0.60, source: 'geological_map', coordinates: [{ latitude: 8.5300, longitude: -82.5800 }, { latitude: 8.5300, longitude: -82.5300 }, { latitude: 8.4800, longitude: -82.5300 }, { latitude: 8.4800, longitude: -82.5800 }] },
  { id: 'chiriqui-dolega', probability: 'media', confidence: 0.55, source: 'geological_map', coordinates: [{ latitude: 8.6500, longitude: -82.4400 }, { latitude: 8.6500, longitude: -82.3900 }, { latitude: 8.6000, longitude: -82.3900 }, { latitude: 8.6000, longitude: -82.4400 }] },
  { id: 'chiriqui-alanje', probability: 'media', confidence: 0.58, source: 'geological_map', coordinates: [{ latitude: 8.4200, longitude: -82.5800 }, { latitude: 8.4200, longitude: -82.5400 }, { latitude: 8.3800, longitude: -82.5400 }, { latitude: 8.3800, longitude: -82.5800 }] },
  { id: 'chiriqui-paso-canoas', probability: 'media', confidence: 0.52, source: 'geological_map', coordinates: [{ latitude: 8.5800, longitude: -82.8600 }, { latitude: 8.5800, longitude: -82.8000 }, { latitude: 8.5200, longitude: -82.8000 }, { latitude: 8.5200, longitude: -82.8600 }] },
  { id: 'chiriqui-caldera', probability: 'media', confidence: 0.57, source: 'geological_map', coordinates: [{ latitude: 8.7700, longitude: -82.3500 }, { latitude: 8.7700, longitude: -82.2900 }, { latitude: 8.7000, longitude: -82.2900 }, { latitude: 8.7000, longitude: -82.3500 }] },
  { id: 'chiriqui-horconcitos', probability: 'baja', confidence: 0.38, source: 'geological_map', coordinates: [{ latitude: 8.3500, longitude: -82.2000 }, { latitude: 8.3500, longitude: -82.1200 }, { latitude: 8.2800, longitude: -82.1200 }, { latitude: 8.2800, longitude: -82.2000 }] },
  { id: 'chiriqui-puerto-armuelles', probability: 'baja', confidence: 0.33, source: 'geological_map', coordinates: [{ latitude: 8.3200, longitude: -82.9000 }, { latitude: 8.3200, longitude: -82.8300 }, { latitude: 8.2500, longitude: -82.8300 }, { latitude: 8.2500, longitude: -82.9000 }] },
  { id: 'chiriqui-tole', probability: 'baja', confidence: 0.40, source: 'geological_map', coordinates: [{ latitude: 8.2800, longitude: -81.7000 }, { latitude: 8.2800, longitude: -81.6400 }, { latitude: 8.2200, longitude: -81.6400 }, { latitude: 8.2200, longitude: -81.7000 }] },
  { id: 'chiriqui-san-felix', probability: 'baja', confidence: 0.35, source: 'geological_map', coordinates: [{ latitude: 8.3200, longitude: -81.8900 }, { latitude: 8.3200, longitude: -81.8400 }, { latitude: 8.2700, longitude: -81.8400 }, { latitude: 8.2700, longitude: -81.8900 }] },
]

const ZONE_INFO: Record<string, { depth: string; type: string }> = {
  'chiriqui-david-cerro-pelado': { depth: '15–40 m', type: 'Caliza masiva cristalina' },
  'chiriqui-gualaca': { depth: '10–30 m', type: 'Caliza estratificada' },
  'chiriqui-bugaba': { depth: '8–25 m', type: 'Caliza arcillosa' },
  'chiriqui-boqueron': { depth: '5–20 m', type: 'Caliza margosa' },
  'chiriqui-dolega': { depth: '6–18 m', type: 'Caliza detrítica' },
  'chiriqui-alanje': { depth: '4–15 m', type: 'Caliza arenosa' },
  'chiriqui-paso-canoas': { depth: '3–12 m', type: 'Caliza arrecifal' },
  'chiriqui-caldera': { depth: '5–20 m', type: 'Caliza termal fosilífera' },
  'chiriqui-horconcitos': { depth: '2–8 m', type: 'Caliza margosa costera' },
  'chiriqui-puerto-armuelles': { depth: '2–6 m', type: 'Caliza areniscosa' },
  'chiriqui-tole': { depth: '3–10 m', type: 'Caliza lutítica' },
  'chiriqui-san-felix': { depth: '2–8 m', type: 'Caliza conglomerádica' },
}

export function CalizaScreen() {
  const currentLocation = useCurrentLocation()
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const mapRef = useRef<any>(null)

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
    const matched = ZONES.filter(z => z.probability === prob)
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

      <>
        <MapView ref={mapRef} style={styles.map}
          initialRegion={{
            latitude: 8.4500, longitude: -82.4000,
            latitudeDelta: 0.6, longitudeDelta: 0.6,
          }}
        >
          {ZONES.map(zone => {
            const zi = PROB_LEVELS.indexOf(zone.probability as 'alta' | 'media' | 'baja')
            const isHighlighted = selectedIdx !== null && zi === selectedIdx
            return (
              <Polygon key={zone.id} coordinates={zone.coordinates}
                fillColor={PROB_COLORS[zone.probability]}
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
          const probZones = ZONES.filter(z => z.probability === prob)
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
                const info = ZONE_INFO[zone.id]
                return (
                  <View key={zone.id} style={styles.zoneItem}>
                    <Text style={styles.zoneName}>{zone.id.replace('chiriqui-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
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
  zoneDetail: { color: COLORS.textSecondary, fontSize: 13, marginVertical: 1 },
})
