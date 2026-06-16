import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import MapView, { Polygon, Marker } from '../components/MapViewWrapper'
import { COLORS, MAP_STYLE } from '../types/constants'
import { analyzeSatelliteRegion, getCarbonateIndexDescription, getNDVIDescription } from '../services/satelliteService'
import { SatelliteAnalysis, CalizaZone } from '../types'
import { useCurrentLocation } from '../services/locationService'
import { saveZone } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { ProbabilityBadge } from '../components/ProbabilityBadge'

export function SatelliteAnalysisScreen() {
  const currentLocation = useCurrentLocation()
  const { addZone } = useAppStore()
  const [analysis, setAnalysis] = useState<SatelliteAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedZone, setSelectedZone] = useState<CalizaZone | null>(null)

  const startAnalysis = async () => {
    if (!currentLocation) return
    setAnalyzing(true)
    const result = await analyzeSatelliteRegion(
      currentLocation.latitude,
      currentLocation.longitude,
      5,
    )
    setAnalysis(result)
    setAnalyzing(false)

    for (const zone of result.zones) {
      await saveZone(zone)
      addZone(zone)
    }
  }

  const getZoneColor = (probability: string) => {
    switch (probability) {
      case 'alta': return COLORS.probabilityHigh + '60'
      case 'media': return COLORS.probabilityMedium + '60'
      case 'baja': return COLORS.probabilityLow + '60'
      default: return COLORS.probabilityPending + '60'
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Análisis satelital</Text>
      <Text style={styles.subtitle}>
        Analiza imágenes satelitales para detectar zonas con potencial de caliza usando bandas SWIR
      </Text>

      {!currentLocation ? (
        <Text style={styles.waiting}>Obteniendo ubicación GPS...</Text>
      ) : (
        <TouchableOpacity
          style={[styles.analyzeBtn, analyzing && styles.analyzingBtn]}
          onPress={startAnalysis}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.analyzeBtnText}>
              {analysis ? 'Re-analizar área' : 'Analizar área actual'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {analysis && (
        <>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              customMapStyle={MAP_STYLE}
              initialRegion={{
                latitude: analysis.location.latitude,
                longitude: analysis.location.longitude,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }}
            >
              <Marker
                coordinate={analysis.location}
                title="Centro de análisis"
                pinColor={COLORS.accent}
              />
              {analysis.zones.map(zone => (
                <Polygon
                  key={zone.id}
                  coordinates={zone.coordinates}
                  fillColor={getZoneColor(zone.probability)}
                  strokeColor={getZoneColor(zone.probability)}
                  strokeWidth={2}
                  tappable
                  onPress={() => setSelectedZone(zone)}
                />
              ))}
            </MapView>
          </View>

          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Leyenda de probabilidad</Text>
            {(['alta', 'media', 'baja', 'pendiente'] as const).map(p => (
              <ProbabilityBadge key={p} probability={p} size="small" />
            ))}
          </View>

          {selectedZone && (
            <View style={styles.zoneInfo}>
              <Text style={styles.zoneTitle}>Zona seleccionada</Text>
              <ProbabilityBadge probability={selectedZone.probability} size="medium" />
              <Text style={styles.confidence}>
                Confianza: {(selectedZone.confidence * 100).toFixed(0)}%
              </Text>
              <Text style={styles.source}>
                Fuente: {selectedZone.source}
              </Text>
            </View>
          )}

          <View style={styles.indices}>
            <Text style={styles.sectionTitle}>Índices espectrales</Text>
            <View style={styles.indexRow}>
              <Text style={styles.indexLabel}>Índice de carbonatos:</Text>
              <Text style={styles.indexValue}>{(analysis.carbonateIndex * 100).toFixed(1)}%</Text>
            </View>
            <Text style={styles.indexDesc}>{getCarbonateIndexDescription(analysis.carbonateIndex)}</Text>
            <View style={styles.indexRow}>
              <Text style={styles.indexLabel}>NDVI:</Text>
              <Text style={styles.indexValue}>{analysis.ndvi.toFixed(3)}</Text>
            </View>
            <Text style={styles.indexDesc}>{getNDVIDescription(analysis.ndvi)}</Text>
            <View style={styles.indexRow}>
              <Text style={styles.indexLabel}>Relación arcilla:</Text>
              <Text style={styles.indexValue}>{(analysis.clayRatio * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.indexRow}>
              <Text style={styles.indexLabel}>Índice de cuarzo:</Text>
              <Text style={styles.indexValue}>{(analysis.quartzIndex * 100).toFixed(1)}%</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 4 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, paddingHorizontal: 16, marginBottom: 16 },
  waiting: { color: COLORS.textMuted, textAlign: 'center', margin: 20 },
  analyzeBtn: {
    backgroundColor: COLORS.accent,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  analyzingBtn: { opacity: 0.7 },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  mapContainer: { height: 300, margin: 16, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
  legend: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  legendTitle: { color: COLORS.textSecondary, fontSize: 12, width: '100%', marginBottom: 4 },
  zoneInfo: {
    backgroundColor: COLORS.surface,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  zoneTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  confidence: { color: COLORS.textSecondary, fontSize: 14 },
  source: { color: COLORS.textMuted, fontSize: 12 },
  indices: { padding: 16 },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  indexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  indexLabel: { color: COLORS.textSecondary, fontSize: 14 },
  indexValue: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  indexDesc: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8, marginTop: 2 },
})
