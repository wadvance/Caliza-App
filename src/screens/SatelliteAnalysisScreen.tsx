import { useState, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native'
import MapView, { Polygon, Marker } from '../components/MapViewWrapper'
import { COLORS } from '../types/constants'
import { analyzeSatelliteRegion, getCarbonateIndexDescription, getNDVIDescription, getSWIRBandDescription } from '../services/satelliteService'
import { SatelliteAnalysis, CalizaZone } from '../types'
import { useCurrentLocation } from '../services/locationService'
import { saveZone } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { ProbabilityBadge } from '../components/ProbabilityBadge'

function SpectralBar({ label, value, color, desc }: { label: string; value: number; color: string; desc: string }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, { color }]}>{(value * 100).toFixed(1)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, value * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barDesc}>{desc}</Text>
    </View>
  )
}

function SWIRChart({ bands }: { bands: { band11: number; band12: number; band6: number; band7: number } }) {
  const maxVal = Math.max(bands.band11, bands.band12, bands.band6, bands.band7, 0.3)

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Espectro SWIR (reflectancia)</Text>
      <View style={styles.chart}>
        <View style={styles.chartBar}>
          <View style={[styles.chartFill, { height: `${(bands.band11 / maxVal) * 100}%`, backgroundColor: '#e94560' }]} />
          <Text style={styles.chartLabel}>B11{'\n'}1.61µm</Text>
        </View>
        <View style={styles.chartBar}>
          <View style={[styles.chartFill, { height: `${(bands.band12 / maxVal) * 100}%`, backgroundColor: '#f39c12' }]} />
          <Text style={styles.chartLabel}>B12{'\n'}2.19µm</Text>
        </View>
        <View style={styles.chartBar}>
          <View style={[styles.chartFill, { height: `${(bands.band6 / maxVal) * 100}%`, backgroundColor: '#2ecc71' }]} />
          <Text style={styles.chartLabel}>B6{'\n'}1.60µm</Text>
        </View>
        <View style={styles.chartBar}>
          <View style={[styles.chartFill, { height: `${(bands.band7 / maxVal) * 100}%`, backgroundColor: '#3498db' }]} />
          <Text style={styles.chartLabel}>B7{'\n'}2.20µm</Text>
        </View>
      </View>
      <Text style={styles.chartNote}>
        Carbonatos: absorción en 2.2µm (B12/B7) | Arcillas: absorción en 1.6µm (B11/B6)
      </Text>
    </View>
  )
}

export function SatelliteAnalysisScreen() {
  const currentLocation = useCurrentLocation()
  const { addZone } = useAppStore()
  const [analysis, setAnalysis] = useState<SatelliteAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedZone, setSelectedZone] = useState<CalizaZone | null>(null)

  const satelliteMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#a0a0b0' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f3460' }] },
  ]

  const startAnalysis = async () => {
    if (!currentLocation) return
    setAnalyzing(true)
    setSelectedZone(null)
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

  const getZoneStroke = (probability: string) => {
    switch (probability) {
      case 'alta': return COLORS.probabilityHigh
      case 'media': return COLORS.probabilityMedium
      case 'baja': return COLORS.probabilityLow
      default: return COLORS.probabilityPending
    }
  }

  const interpretation = useMemo(() => {
    if (!analysis) return ''
    const { carbonateIndex, clayRatio, ndvi, quartzIndex } = analysis
    if (carbonateIndex > 0.6 && clayRatio < 0.3 && ndvi < 0.3)
      return 'Alta probabilidad de caliza: firma SWIR de carbonatos, baja arcilla, suelo expuesto'
    if (carbonateIndex > 0.4)
      return 'Potencial moderado: presencia de carbonatos, verificar en campo'
    if (clayRatio > 0.5)
      return 'Predominio de arcillas: zona no favorable para caliza'
    return 'Zona mixta sin firma clara de carbonatos'
  }, [analysis])

  const handleExport = async () => {
    if (!analysis) return
    const text = [
      `=== GeoCaliza - Análisis Satelital SWIR ===`,
      `Coordenadas: ${analysis.location.latitude}, ${analysis.location.longitude}`,
      `Elevación estimada: ${analysis.elevation || 'N/A'} msnm`,
      `Fuente: ${analysis.source.toUpperCase()}`,
      `Fecha: ${new Date(analysis.date).toLocaleString()}`,
      ``,
      `Índices espectrales:`,
      `  Carbonato: ${(analysis.carbonateIndex * 100).toFixed(1)}%`,
      `  Arcilla: ${(analysis.clayRatio * 100).toFixed(1)}%`,
      `  NDVI: ${analysis.ndvi.toFixed(3)}`,
      `  Cuarzo: ${(analysis.quartzIndex * 100).toFixed(1)}%`,
      ``,
      `Interpretación: ${interpretation}`,
      ``,
      `Zonas detectadas: ${analysis.zones.length}`,
      ...analysis.zones.map((z, i) =>
        `  ${i + 1}. ${z.probability} (conf: ${(z.confidence * 100).toFixed(0)}%) - ${z.estimatedRockType || 'N/A'}`
      ),
      ``,
      `--- GeoCaliza v1.0 ---`,
    ].join('\n')

    if (typeof document !== 'undefined') {
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analisis_swir_${Date.now()}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      try {
        await Share.share({ message: text, title: 'Análisis SWIR' })
      } catch {}
    }
    Alert.alert('Exportado', 'Reporte guardado')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>🛰️ Análisis satelital SWIR</Text>
        <Text style={styles.subtitle}>
          Bandas de infrarrojo de onda corta (SWIR 1.6-2.2µm) para detección de carbonatos
        </Text>
      </View>

      {!currentLocation ? (
        <Text style={styles.waiting}>📍 Obteniendo ubicación GPS...</Text>
      ) : (
        <TouchableOpacity
          style={[styles.analyzeBtn, analyzing && styles.analyzingBtn]}
          onPress={startAnalysis}
          disabled={analyzing}
        >
          {analyzing ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.analyzeBtnText}> Procesando bandas SWIR...</Text>
            </View>
          ) : (
            <Text style={styles.analyzeBtnText}>
              {analysis ? '🔄 Re-analizar área' : '🚀 Iniciar análisis SWIR'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {analysis && (
        <>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              customMapStyle={satelliteMapStyle}
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
                pinColor={COLORS.highlight}
              />
              {analysis.zones.map(zone => (
                <Polygon
                  key={zone.id}
                  coordinates={zone.coordinates}
                  fillColor={getZoneColor(zone.probability)}
                  strokeColor={getZoneStroke(zone.probability)}
                  strokeWidth={2}
                  tappable
                  onPress={() => setSelectedZone(zone)}
                />
              ))}
            </MapView>
            <View style={styles.mapBadge}>
              <Text style={styles.mapBadgeText}>Esri World Imagery</Text>
            </View>
          </View>

          {analysis.swirBands && <SWIRChart bands={analysis.swirBands} />}

          <View style={styles.indices}>
            <Text style={styles.sectionTitle}>📊 Índices espectrales</Text>
            <SpectralBar label="Índice de carbonatos" value={analysis.carbonateIndex} color={COLORS.probabilityHigh}
              desc={getCarbonateIndexDescription(analysis.carbonateIndex)} />
            <SpectralBar label="Relación de arcillas" value={analysis.clayRatio} color={COLORS.warning}
              desc={analysis.clayRatio > 0.4 ? 'Alto contenido de arcilla' : 'Bajo contenido de arcilla'} />
            <SpectralBar label="NDVI (vegetación)" value={analysis.ndvi} color={COLORS.success}
              desc={getNDVIDescription(analysis.ndvi)} />
            <SpectralBar label="Índice de cuarzo" value={analysis.quartzIndex} color={COLORS.probabilityPending}
              desc={analysis.quartzIndex > 0.3 ? 'Presencia de cuarzo detectada' : 'Bajo contenido de cuarzo'} />
          </View>

          <View style={styles.interpretation}>
            <Text style={styles.sectionTitle}>🔍 Interpretación</Text>
            <Text style={styles.interpText}>{interpretation}</Text>
            {analysis.elevation !== undefined && (
              <Text style={styles.elevText}>Elevación estimada: {analysis.elevation} msnm</Text>
            )}
            <Text style={styles.sourceText}>Fuente: {analysis.source.toUpperCase()} | SWIR bands 11,12 y 6,7</Text>
          </View>

          <View style={styles.zonesSection}>
            <Text style={styles.sectionTitle}>🎯 Zonas detectadas ({analysis.zones.length})</Text>
            {analysis.zones.map((zone, i) => (
              <TouchableOpacity key={zone.id}
                style={[styles.zoneCard, selectedZone?.id === zone.id && styles.zoneCardSelected]}
                onPress={() => setSelectedZone(zone)}
              >
                <View style={styles.zoneCardBody}>
                  <View style={styles.zoneCardLeft}>
                    <Text style={styles.zoneIndex}>Z{i + 1}</Text>
                    <ProbabilityBadge probability={zone.probability} size="small" />
                  </View>
                  <View style={styles.zoneCardRight}>
                    <Text style={styles.zoneType}>{zone.estimatedRockType || 'No clasificado'}</Text>
                    <Text style={styles.zoneConf}>Confianza: {(zone.confidence * 100).toFixed(0)}%</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Referencia de probabilidad</Text>
            {(['alta', 'media', 'baja', 'pendiente'] as const).map(p => (
              <ProbabilityBadge key={p} probability={p} size="small" />
            ))}
          </View>

          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Text style={styles.exportBtnText}>📥 Exportar análisis</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  header: { padding: 16, paddingTop: 20 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  waiting: { color: COLORS.textMuted, textAlign: 'center', margin: 30, fontSize: 15 },
  analyzeBtn: {
    backgroundColor: COLORS.accent,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  analyzingBtn: { opacity: 0.7 },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  mapContainer: { height: 300, margin: 16, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  mapBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  mapBadgeText: { color: '#aaa', fontSize: 10 },
  chartContainer: { backgroundColor: COLORS.surface, margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  chartTitle: { color: COLORS.accent, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  chart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 },
  chartBar: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartFill: { width: 28, borderRadius: 6, minHeight: 4 },
  chartLabel: { color: COLORS.textMuted, fontSize: 8, textAlign: 'center', marginTop: 6 },
  chartNote: { color: COLORS.textMuted, fontSize: 11, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
  indices: { padding: 16 },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  barRow: { marginBottom: 14 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { color: COLORS.textSecondary, fontSize: 13 },
  barValue: { fontSize: 13, fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: COLORS.surfaceLight, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barDesc: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  interpretation: {
    backgroundColor: COLORS.surface,
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  interpText: { color: COLORS.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  elevText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  sourceText: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  zonesSection: { padding: 16 },
  zoneCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  zoneCardSelected: { borderColor: COLORS.highlight, backgroundColor: COLORS.surfaceLight },
  zoneCardBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneCardLeft: { alignItems: 'center', gap: 4, minWidth: 60 },
  zoneIndex: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  zoneCardRight: { flex: 1 },
  zoneType: { color: COLORS.text, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  zoneConf: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  legend: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  legendTitle: { color: COLORS.textSecondary, fontSize: 12, width: '100%', marginBottom: 4 },
  exportBtn: {
    backgroundColor: COLORS.surface,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportBtnText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
})
