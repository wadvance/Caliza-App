import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, TextInput } from 'react-native'
import MapView, { Polygon, Marker, setTileUrl } from '../components/MapViewWrapper'
import { COLORS } from '../types/constants'
import { analyzeSatelliteRegion, analyzeGridRegion, getCarbonateIndexDescription, getNDVIDescription } from '../services/satelliteService'
import { SatelliteAnalysis, CalizaZone, GridCell, GridAnalysis } from '../types'
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

function getCarbonateColor(index: number): string {
  if (index > 0.7) return COLORS.probabilityHigh
  if (index > 0.5) return COLORS.probabilityMedium
  if (index > 0.3) return COLORS.probabilityLow
  return COLORS.probabilityPending
}

export function SatelliteAnalysisScreen() {
  const currentLocation = useCurrentLocation()
  const { addZone } = useAppStore()
  const [analysis, setAnalysis] = useState<SatelliteAnalysis | null>(null)
  const [gridAnalysis, setGridAnalysis] = useState<GridAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [mode, setMode] = useState<'point' | 'grid'>('point')
  const [radiusKm, setRadiusKm] = useState(5)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<{ lat: number; lng: number; displayName: string }[]>([])
  const [customCenter, setCustomCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [progress, setProgress] = useState(0)

  React.useEffect(() => {
    setTileUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
  }, [])

  const center = customCenter || (currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null)

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchResults([])
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=es`
      const res = await fetch(url, { headers: { 'User-Agent': 'GeoCaliza/1.0' }, signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setSearchResults(data.map((r: any) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), displayName: r.display_name })))
        }
      }
    } catch {}
    setSearching(false)
  }, [searchQuery])

  const selectSearchResult = useCallback((result: { lat: number; lng: number; displayName: string }) => {
    setCustomCenter({ lat: result.lat, lng: result.lng })
    setSearchQuery(result.displayName.split(',')[0])
    setSearchResults([])
    setAnalysis(null)
    setGridAnalysis(null)
  }, [])

  const startAnalysis = async () => {
    if (!center) return
    setAnalyzing(true)
    setProgress(0)
    setSearchResults([])

    try {
      if (mode === 'grid') {
        const result = await analyzeGridRegion(center.lat, center.lng, radiusKm, 7, setProgress)
        setGridAnalysis(result)
        setAnalysis(null)
      } else {
        setProgress(0.3)
        await new Promise(r => setTimeout(r, 300))
        const result = await analyzeSatelliteRegion(center.lat, center.lng, radiusKm)
        setAnalysis(result)
        setGridAnalysis(null)
        setProgress(1)
      }
    } catch {}
    setAnalyzing(false)
  }

  const interpretation = useMemo(() => {
    if (!analysis) return ''
    const { carbonateIndex, clayRatio, ndvi } = analysis
    if (carbonateIndex > 0.6 && clayRatio < 0.3 && ndvi < 0.3)
      return 'Alta probabilidad de caliza: firma SWIR de carbonatos, baja arcilla, suelo expuesto'
    if (carbonateIndex > 0.4)
      return 'Potencial moderado: presencia de carbonatos, verificar en campo'
    if (clayRatio > 0.5)
      return 'Predominio de arcillas: zona no favorable para caliza'
    return 'Zona mixta sin firma clara de carbonatos'
  }, [analysis])

  const handleExport = async () => {
    const lines: string[] = [
      `=== GeoCaliza - Análisis Satelital SWIR ===`,
      `Coordenadas: ${center?.lat}, ${center?.lng}`,
      `Radio: ${radiusKm} km`,
      `Modo: ${mode === 'grid' ? 'Exploración por cuadrícula' : 'Puntual'}`,
      `Fecha: ${new Date().toLocaleString()}`,
      ``,
    ]

    if (gridAnalysis) {
      const g = gridAnalysis
      lines.push(
        `Análisis por cuadrícula (${g.gridSize}×${g.gridSize}):`,
        `  Celdas: ${g.cells.length}`,
        `  Tamaño de celda: ${g.cellSizeKm} km`,
        `  Carbonato promedio: ${(g.stats.avgCarbonate * 100).toFixed(1)}%`,
        `  Carbonato máximo: ${(g.stats.maxCarbonate * 100).toFixed(1)}%`,
        `  Área de alta probabilidad: ${g.stats.highProbabilityArea} km²`,
        `  Área total: ${g.stats.totalAreaKm2} km²`,
        ``,
      )
    }

    if (analysis) {
      lines.push(
        `Índices espectrales:`,
        `  Carbonato: ${(analysis.carbonateIndex * 100).toFixed(1)}%`,
        `  Arcilla: ${(analysis.clayRatio * 100).toFixed(1)}%`,
        `  NDVI: ${analysis.ndvi.toFixed(3)}`,
        `  Cuarzo: ${(analysis.quartzIndex * 100).toFixed(1)}%`,
        ``,
        `Interpretación: ${interpretation}`,
        ``,
        `Elevación: ${analysis.elevation || 'N/A'} msnm`,
        ``,
        `Zonas detectadas: ${analysis.zones.length}`,
      )
    }

    lines.push(`--- GeoCaliza v1.0 ---`)
    const text = lines.join('\n')

    if (typeof document !== 'undefined') {
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analisis_swir_${Date.now()}.txt`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 1000)
    } else {
      try {
        await Share.share({ message: text, title: 'Análisis SWIR' })
      } catch {}
    }
    Alert.alert('Exportado', 'Reporte guardado')
  }

  const gridCells = useMemo(() => {
    if (!gridAnalysis) return []
    const allPolygons: { coords: { latitude: number; longitude: number }[]; fillColor: string; strokeColor: string }[] = []
    for (const cell of gridAnalysis.cells) {
      const color = getCarbonateColor(cell.carbonateIndex)
      allPolygons.push({
        coords: cell.coordinates,
        fillColor: color,
        strokeColor: color,
      })
    }
    return allPolygons
  }, [gridAnalysis])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🛰️ Análisis satelital SWIR</Text>
        <Text style={styles.subtitle}>
          Búsqueda de carbonatos por satélite con cuadrícula exploratoria
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar lugar (ej. Chiriquí, David, Cerro...)"
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={t => { setSearchQuery(t); setSearchResults([]) }}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
          <Text style={styles.searchBtnText}>{searching ? '...' : '🔍'}</Text>
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.map((r, i) => (
            <TouchableOpacity key={i} style={styles.searchResultItem} onPress={() => selectSearchResult(r)}>
              <Text style={styles.searchResultText} numberOfLines={2}>{r.displayName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {customCenter && (
        <View style={styles.customCenterBadge}>
          <Text style={styles.customCenterText}>📍 {searchQuery || `${customCenter.lat.toFixed(4)}, ${customCenter.lng.toFixed(4)}`}</Text>
          <TouchableOpacity onPress={() => { setCustomCenter(null); setSearchQuery(''); setAnalysis(null); setGridAnalysis(null) }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mode selector */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'point' && styles.modeBtnActive]}
          onPress={() => setMode('point')}
        >
          <Text style={[styles.modeBtnText, mode === 'point' && styles.modeBtnTextActive]}>📍 Puntual</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'grid' && styles.modeBtnActive]}
          onPress={() => setMode('grid')}
        >
          <Text style={[styles.modeBtnText, mode === 'grid' && styles.modeBtnTextActive]}>🗺️ Cuadrícula</Text>
        </TouchableOpacity>
      </View>

      {/* Radius control */}
      <View style={styles.radiusControl}>
        <Text style={styles.radiusLabel}>Radio: {radiusKm} km</Text>
        <View style={styles.radiusButtons}>
          <TouchableOpacity
            style={styles.radiusBtn}
            onPress={() => setRadiusKm(Math.max(1, radiusKm - 1))}
          >
            <Text style={styles.radiusBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.radiusBar}>
            <View style={[styles.radiusFill, { width: `${(radiusKm / 20) * 100}%` }]} />
          </View>
          <TouchableOpacity
            style={styles.radiusBtn}
            onPress={() => setRadiusKm(Math.min(20, radiusKm + 1))}
          >
            <Text style={styles.radiusBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Analyze button */}
      {center ? (
        <TouchableOpacity
          style={[styles.analyzeBtn, analyzing && styles.analyzingBtn]}
          onPress={startAnalysis}
          disabled={analyzing}
        >
          {analyzing ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.analyzeBtnText}> {(progress * 100).toFixed(0)}%</Text>
            </View>
          ) : (
            <Text style={styles.analyzeBtnText}>
              {(analysis || gridAnalysis) ? '🔄 Re-analizar área' : '🚀 Iniciar análisis'}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.waiting}>📍 Obteniendo ubicación GPS...</Text>
      )}

      {/* Map */}
      {(analysis || gridAnalysis) && center && (
        <>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: center.lat,
                longitude: center.lng,
                latitudeDelta: radiusKm / 50,
                longitudeDelta: radiusKm / 50,
              }}
            >
              <Marker
                coordinate={{ latitude: center.lat, longitude: center.lng }}
                title="Centro de análisis"
                pinColor={COLORS.highlight}
              />

              {/* Grid heatmap cells */}
              {gridCells.map((cell, i) => (
                <Polygon
                  key={`grid_${i}`}
                  coordinates={cell.coords}
                  fillColor={cell.fillColor}
                  strokeColor={cell.strokeColor}
                  strokeWidth={1}
                />
              ))}

              {/* Zone polygons */}
              {analysis?.zones.map(zone => (
                <Polygon
                  key={zone.id}
                  coordinates={zone.coordinates}
                  fillColor={getCarbonateColor(
                    zone.probability === 'alta' ? 0.8 : zone.probability === 'media' ? 0.6 : zone.probability === 'baja' ? 0.3 : 0
                  )}
                  strokeColor={getCarbonateColor(
                    zone.probability === 'alta' ? 0.8 : zone.probability === 'media' ? 0.6 : zone.probability === 'baja' ? 0.3 : 0
                  )}
                  strokeWidth={2}
                />
              ))}
            </MapView>
            <View style={styles.mapBadge}>
              <Text style={styles.mapBadgeText}>Esri World Imagery · {radiusKm} km</Text>
            </View>
          </View>

          {/* Grid stats */}
          {gridAnalysis && (
            <View style={styles.gridStats}>
              <Text style={styles.sectionTitle}>📊 Estadísticas de cuadrícula {gridAnalysis.gridSize}×{gridAnalysis.gridSize}</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{(gridAnalysis.stats.avgCarbonate * 100).toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Carbonato promedio</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: COLORS.probabilityHigh }]}>{(gridAnalysis.stats.maxCarbonate * 100).toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Máximo</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{gridAnalysis.stats.highProbabilityArea} km²</Text>
                  <Text style={styles.statLabel}>Área de alto potencial</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{gridAnalysis.stats.totalAreaKm2} km²</Text>
                  <Text style={styles.statLabel}>Área total explorada</Text>
                </View>
              </View>
            </View>
          )}

          {/* Heatmap legend */}
          {gridAnalysis && (
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Potencial de carbonatos</Text>
              <View style={styles.legendBar}>
                <View style={[styles.legendSegment, { backgroundColor: COLORS.probabilityPending }]} />
                <View style={[styles.legendSegment, { backgroundColor: COLORS.probabilityLow }]} />
                <View style={[styles.legendSegment, { backgroundColor: COLORS.probabilityMedium }]} />
                <View style={[styles.legendSegment, { backgroundColor: COLORS.probabilityHigh }]} />
              </View>
              <View style={styles.legendLabels}>
                <Text style={styles.legendLabel}>Bajo</Text>
                <Text style={styles.legendLabel}>Alto</Text>
              </View>
            </View>
          )}

          {/* Point analysis details */}
          {analysis && analysis.swirBands && <SWIRChart bands={analysis.swirBands} />}

          {analysis && (
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
          )}

          {analysis && (
            <View style={styles.interpretation}>
              <Text style={styles.sectionTitle}>🔍 Interpretación</Text>
              <Text style={styles.interpText}>{interpretation}</Text>
              {analysis.elevation !== undefined && (
                <Text style={styles.elevText}>Elevación: {analysis.elevation} msnm</Text>
              )}
              <Text style={styles.sourceText}>Fuente: SENTINEL2 | SWIR bands 11,12 y 6,7</Text>
            </View>
          )}

          {analysis && analysis.zones.length > 0 && (
            <View style={styles.zonesSection}>
              <Text style={styles.sectionTitle}>🎯 Zonas detectadas ({analysis.zones.length})</Text>
              {analysis.zones.map((zone, i) => (
                <View key={zone.id} style={styles.zoneCard}>
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
                </View>
              ))}
            </View>
          )}

          {/* Heatmap legend for point mode */}
          {!gridAnalysis && (
            <View style={styles.legend}>
              <Text style={styles.legendTitle}>Referencia de probabilidad</Text>
              {(['alta', 'media', 'baja', 'pendiente'] as const).map(p => (
                <ProbabilityBadge key={p} probability={p} size="small" />
              ))}
            </View>
          )}

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

  /* Search */
  searchBox: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8,
  },
  searchInput: {
    flex: 1, backgroundColor: COLORS.surface, color: COLORS.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  searchBtn: {
    width: 44, backgroundColor: COLORS.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { fontSize: 18 },
  searchResults: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  searchResultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchResultText: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  customCenterBadge: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.accent + '20',
    padding: 10, borderRadius: 10, alignItems: 'center', gap: 8,
  },
  customCenterText: { color: COLORS.accent, fontSize: 13, flex: 1 },
  clearBtn: { color: COLORS.textMuted, fontSize: 16, padding: 4 },

  /* Mode */
  modeRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8 },
  modeBtn: {
    flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  modeBtnActive: { backgroundColor: COLORS.accent + '20', borderColor: COLORS.accent },
  modeBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: COLORS.accent },

  /* Radius */
  radiusControl: { marginHorizontal: 16, marginBottom: 8 },
  radiusLabel: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6 },
  radiusButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radiusBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radiusBtnText: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  radiusBar: {
    flex: 1, height: 6, backgroundColor: COLORS.surfaceLight, borderRadius: 3, overflow: 'hidden',
  },
  radiusFill: { height: '100%', backgroundColor: COLORS.accent, borderRadius: 3 },

  /* Analyze */
  analyzeBtn: { backgroundColor: COLORS.accent, margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  analyzingBtn: { opacity: 0.7 },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  /* Map */
  mapContainer: { height: 350, margin: 16, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  mapBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  mapBadgeText: { color: '#aaa', fontSize: 10 },

  /* Grid stats */
  gridStats: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border,
    width: '48%', alignItems: 'center',
  },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4, textAlign: 'center' },

  /* Legend */
  legend: { padding: 16, paddingTop: 0 },
  legendTitle: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 6 },
  legendBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  legendSegment: { flex: 1 },
  legendLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  legendLabel: { color: COLORS.textMuted, fontSize: 10 },

  /* Chart */
  chartContainer: { backgroundColor: COLORS.surface, margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  chartTitle: { color: COLORS.accent, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  chart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 },
  chartBar: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartFill: { width: 28, borderRadius: 6, minHeight: 4 },
  chartLabel: { color: COLORS.textMuted, fontSize: 8, textAlign: 'center', marginTop: 6 },
  chartNote: { color: COLORS.textMuted, fontSize: 11, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },

  /* Indices */
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
    backgroundColor: COLORS.surface, margin: 16, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  interpText: { color: COLORS.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  elevText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  sourceText: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },

  /* Zones */
  zonesSection: { padding: 16 },
  zoneCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  zoneCardBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneCardLeft: { alignItems: 'center', gap: 4, minWidth: 60 },
  zoneIndex: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  zoneCardRight: { flex: 1 },
  zoneType: { color: COLORS.text, fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  zoneConf: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  /* Export */
  exportBtn: {
    backgroundColor: COLORS.surface, margin: 16, padding: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  exportBtnText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
})
