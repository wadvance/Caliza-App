import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Share } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { COLORS } from '../types/constants'
import { getAllSamples, getAllZones } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { Sample, CalizaZone, ExplorationReport, ReportStatistics } from '../types'

const isWeb = Platform.OS === 'web'

export function ReportsScreen() {
  const { samples, zones } = useAppStore()
  const [report, setReport] = useState<ExplorationReport | null>(null)
  const [generating, setGenerating] = useState(false)

  const generateReport = async () => {
    setGenerating(true)
    const loadedSamples = samples.length > 0 ? samples : await getAllSamples()
    const loadedZones = zones.length > 0 ? zones : await getAllZones()

    const validatedSamples = loadedSamples.filter(s => s.status === 'validado')
    const highProbZones = loadedZones.filter(z => z.probability === 'alta')
    const avgConfidence = loadedSamples.reduce((acc, s) => acc + s.confidenceLevel, 0) / (loadedSamples.length || 1)
    const rockTypes = loadedSamples.map(s => s.estimatedRockType)
    const dominantRock = rockTypes.sort((a, b) =>
      rockTypes.filter(r => r === b).length - rockTypes.filter(r => r === a).length
    )[0] || 'desconocido'

    const stats: ReportStatistics = {
      totalSamples: loadedSamples.length,
      validatedSamples: validatedSamples.length,
      highProbabilityZones: highProbZones.length,
      averageConfidence: avgConfidence,
      dominantRockType: dominantRock,
      areaCoveredKm2: calculateArea(loadedZones),
    }

    const newReport: ExplorationReport = {
      id: `report_${Date.now()}`,
      title: `Reporte de exploración - ${new Date().toLocaleDateString()}`,
      generatedAt: Date.now(),
      author: 'Operador de campo',
      dateRange: {
        start: loadedSamples.length > 0 ? Math.min(...loadedSamples.map(s => s.timestamp)) : Date.now(),
        end: loadedSamples.length > 0 ? Math.max(...loadedSamples.map(s => s.timestamp)) : Date.now(),
      },
      samples: loadedSamples,
      zones: loadedZones,
      statistics: stats,
    }

    setReport(newReport)
    setGenerating(false)
  }

  const handleExport = async (format: string) => {
    if (!report) return
    let content = ''
    let filename = `reporte_caliza_${Date.now()}`
    let mimeType = 'text/plain'

    switch (format) {
      case 'CSV': {
        const headers = 'id,fecha,latitud,longitud,tipo_roca,confianza,estado\n'
        const rows = report.samples.map(s =>
          `${s.id},${new Date(s.timestamp).toISOString()},${s.latitude},${s.longitude},${s.estimatedRockType},${s.confidenceLevel},${s.status}`
        ).join('\n')
        content = headers + rows
        filename += '.csv'
        mimeType = 'text/csv'
        break
      }
      case 'GeoJSON': {
        const geojson = {
          type: 'FeatureCollection',
          features: report.samples.map(s => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
            properties: { id: s.id, rockType: s.estimatedRockType, confidence: s.confidenceLevel, status: s.status, date: new Date(s.timestamp).toISOString() },
          })),
        }
        content = JSON.stringify(geojson, null, 2)
        filename += '.geojson'
        mimeType = 'application/geo+json'
        break
      }
      case 'KML': {
        content = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document><name>GeoCaliza - ${report.title}</name>
${report.zones.filter(z => z.coordinates.length >= 3).map(z => `
<Placemark><name>Zona ${z.probability}</name>
<Polygon><outerBoundaryIs><LinearRing><coordinates>
${z.coordinates.map(c => `${c.longitude},${c.latitude},0`).join('\n')}
</coordinates></LinearRing></outerBoundaryIs></Polygon>
</Placemark>`).join('')}
${report.samples.map(s => `
<Placemark><name>${s.estimatedRockType}</name>
<Point><coordinates>${s.longitude},${s.latitude},0</coordinates></Point>
</Placemark>`).join('')}
</Document></kml>`
        filename += '.kml'
        mimeType = 'application/vnd.google-earth.kml+xml'
        break
      }
      default:
      case 'PDF': {
        content = [
          `REPORTE DE EXPLORACIÓN - GeoCaliza`,
          `================================`,
          `Título: ${report.title}`,
          `Generado: ${new Date(report.generatedAt).toLocaleString()}`,
          `Autor: ${report.author}`,
          `Período: ${new Date(report.dateRange.start).toLocaleDateString()} - ${new Date(report.dateRange.end).toLocaleDateString()}`,
          ``,
          `ESTADÍSTICAS`,
          `Total muestras: ${report.statistics.totalSamples}`,
          `Validadas: ${report.statistics.validatedSamples}`,
          `Zonas alta prob.: ${report.statistics.highProbabilityZones}`,
          `Confianza media: ${(report.statistics.averageConfidence * 100).toFixed(0)}%`,
          `Roca dominante: ${report.statistics.dominantRockType}`,
          `Área cubierta: ${report.statistics.areaCoveredKm2} km²`,
          ``,
          `MUESTRAS (${report.samples.length})`,
          ...report.samples.map(s =>
            `  ${s.id} | ${s.estimatedRockType} | conf: ${(s.confidenceLevel * 100).toFixed(0)}% | ${s.status} | ${new Date(s.timestamp).toLocaleDateString()}`
          ),
        ].join('\n')
        filename += '.txt'
        mimeType = 'text/plain'
      }
    }

    if (isWeb) {
      const blob = new Blob([content], { type: mimeType } as any)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } else {
      try {
        const fileUri = FileSystem.documentDirectory + filename
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        })
        await Share.share({ url: fileUri, title: filename })
      } catch (err) {
        Alert.alert('Error', 'No se pudo exportar el archivo')
        return
      }
    }
    Alert.alert('Exportado', `Reporte exportado como ${format}: ${filename}`)
  }

  const calculateArea = (zones: CalizaZone[]): number => {
    if (zones.length === 0) return 0
    let totalArea = 0
    for (const zone of zones) {
      if (zone.coordinates.length < 3) continue
      let area = 0
      for (let i = 0; i < zone.coordinates.length; i++) {
        const j = (i + 1) % zone.coordinates.length
        area += zone.coordinates[i].longitude * zone.coordinates[j].latitude
        area -= zone.coordinates[j].longitude * zone.coordinates[i].latitude
      }
      totalArea += Math.abs(area) / 2 * 111.32 * 111.32
    }
    return Math.round(totalArea * 100) / 100
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reportes</Text>

      <TouchableOpacity
        style={[styles.generateBtn, generating && styles.generatingBtn]}
        onPress={generateReport}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateBtnText}>
            {report ? 'Actualizar reporte' : 'Generar reporte'}
          </Text>
        )}
      </TouchableOpacity>

      {report && (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Resumen de exploración</Text>
            <View style={styles.statGrid}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{report.statistics.totalSamples}</Text>
                <Text style={styles.statLabel}>Muestras</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{report.statistics.validatedSamples}</Text>
                <Text style={styles.statLabel}>Validadas</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{report.statistics.highProbabilityZones}</Text>
                <Text style={styles.statLabel}>Zonas alta prob.</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {(report.statistics.averageConfidence * 100).toFixed(0)}%
                </Text>
                <Text style={styles.statLabel}>Confianza media</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalles</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Roca dominante</Text>
              <Text style={styles.detailValue}>{report.statistics.dominantRockType}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Área cubierta</Text>
              <Text style={styles.detailValue}>{report.statistics.areaCoveredKm2} km²</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Período</Text>
              <Text style={styles.detailValue}>
                {new Date(report.dateRange.start).toLocaleDateString()} - {new Date(report.dateRange.end).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Generado</Text>
              <Text style={styles.detailValue}>{new Date(report.generatedAt).toLocaleString()}</Text>
            </View>
          </View>

          {report.samples.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Últimas muestras</Text>
              {report.samples.slice(0, 10).map(sample => (
                <View key={sample.id} style={styles.sampleRow}>
                  <View>
                    <Text style={styles.sampleName}>{sample.estimatedRockType}</Text>
                    <Text style={styles.sampleDate}>
                      {new Date(sample.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.sampleStatus, {
                    color: sample.status === 'validado' ? COLORS.success :
                           sample.status === 'descartado' ? COLORS.danger : COLORS.warning
                  }]}>
                    {sample.status}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.exportSection}>
            <Text style={styles.exportSectionTitle}>Exportar como</Text>
            <View style={styles.exportRow}>
              {[
                { format: 'PDF', icon: '📄' },
                { format: 'GeoJSON', icon: '🗺️' },
                { format: 'KML', icon: '📍' },
                { format: 'CSV', icon: '📊' },
              ].map(({ format, icon }) => (
                <TouchableOpacity
                  key={format}
                  style={styles.exportOptBtn}
                  onPress={() => handleExport(format)}
                >
                  <Text style={styles.exportOptIcon}>{icon}</Text>
                  <Text style={styles.exportOptLabel}>{format}</Text>
                </TouchableOpacity>
              ))}
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
  generateBtn: {
    backgroundColor: COLORS.accent,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  generatingBtn: { opacity: 0.7 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  summaryCard: {
    backgroundColor: COLORS.surface,
    margin: 16,
    padding: 20,
    borderRadius: 16,
    marginTop: 0,
  },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { color: COLORS.text, fontSize: 28, fontWeight: '700' },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
  section: { padding: 16 },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: { color: COLORS.textSecondary, fontSize: 14 },
  detailValue: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  sampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sampleName: { color: COLORS.text, fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  sampleDate: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  sampleStatus: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  exportSection: { padding: 16 },
  exportSectionTitle: { color: COLORS.accent, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  exportRow: { flexDirection: 'row', gap: 10 },
  exportOptBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportOptIcon: { fontSize: 24, marginBottom: 4 },
  exportOptLabel: { color: COLORS.accent, fontSize: 12, fontWeight: '600' },
})
