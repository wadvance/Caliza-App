import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { COLORS, SAMPLE_STATUS_LABELS } from '../types/constants'
import { getSampleById, saveSample } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { PhotoGrid } from '../components/PhotoGrid'
import { ProbabilityBadge } from '../components/ProbabilityBadge'
import { Sample } from '../types'

export function SampleDetailScreen({ route, navigation }: any) {
  const { sampleId } = route.params
  const { updateSample } = useAppStore()
  const [sample, setSample] = useState<Sample | null>(null)

  useEffect(() => {
    loadSample()
  }, [sampleId])

  const loadSample = async () => {
    const data = await getSampleById(sampleId)
    setSample(data)
  }

  const changeStatus = async (newStatus: Sample['status']) => {
    if (!sample) return
    const updated = { ...sample, status: newStatus }
    await saveSample(updated)
    updateSample(sample.id, { status: newStatus })
    setSample(updated)
  }

  if (!sample) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Cargando...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhotoGrid photos={sample.photoUri} readonly />

      <View style={styles.header}>
        <View>
          <Text style={styles.rockType}>{sample.estimatedRockType}</Text>
          <Text style={styles.date}>{new Date(sample.timestamp).toLocaleString()}</Text>
        </View>
        <ProbabilityBadge
          probability={
            sample.confidenceLevel > 0.6 ? 'alta' :
            sample.confidenceLevel > 0.3 ? 'media' : 'baja'
          }
          size="medium"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación</Text>
        <Text style={styles.coordText}>
          {sample.latitude.toFixed(6)}, {sample.longitude.toFixed(6)}
        </Text>
        <Text style={styles.coordText}>Altitud: {sample.altitude.toFixed(1)} m</Text>
        {sample.operatorName && (
          <Text style={styles.coordText}>Operador: {sample.operatorName}</Text>
        )}
      </View>

      {sample.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observaciones</Text>
          <Text style={styles.notesText}>{sample.notes}</Text>
        </View>
      )}

      {sample.quickTestResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pruebas rápidas</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reacción HCl</Text>
            <Text style={styles.detailValue}>{sample.quickTestResult.acidReaction}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Dureza</Text>
            <Text style={styles.detailValue}>{sample.quickTestResult.hardness}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Color</Text>
            <Text style={styles.detailValue}>{sample.quickTestResult.color || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Textura</Text>
            <Text style={styles.detailValue}>{sample.quickTestResult.texture || '—'}</Text>
          </View>
          {sample.quickTestResult.estimatedCaCO3 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>CaCO₃ estimado</Text>
              <Text style={styles.detailValue}>{sample.quickTestResult.estimatedCaCO3}%</Text>
            </View>
          )}
        </View>
      )}

      {sample.labResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resultados de laboratorio</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>CaCO₃</Text>
            <Text style={styles.detailValue}>{sample.labResult.caco3Purity}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>MgO</Text>
            <Text style={styles.detailValue}>{sample.labResult.mgo}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>SiO₂</Text>
            <Text style={styles.detailValue}>{sample.labResult.sio2}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Al₂O₃</Text>
            <Text style={styles.detailValue}>{sample.labResult.al2o3}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fe₂O₃</Text>
            <Text style={styles.detailValue}>{sample.labResult.fe2o3}%</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>LOI</Text>
            <Text style={styles.detailValue}>{sample.labResult.loi}%</Text>
          </View>
          <Text style={styles.labName}>Laboratorio: {sample.labResult.laboratoryName}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Text style={styles.sectionTitle}>Estado</Text>
        <View style={styles.statusRow}>
          {(['pendiente', 'validado', 'descartado'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusBtn,
                sample.status === status && {
                  backgroundColor:
                    status === 'validado' ? COLORS.success + '30' :
                    status === 'descartado' ? COLORS.danger + '30' :
                    COLORS.warning + '30',
                  borderColor:
                    status === 'validado' ? COLORS.success :
                    status === 'descartado' ? COLORS.danger :
                    COLORS.warning,
                },
              ]}
              onPress={() => changeStatus(status)}
            >
              <Text style={[styles.statusBtnText, {
                color:
                  sample.status === status
                    ? (status === 'validado' ? COLORS.success :
                       status === 'descartado' ? COLORS.danger :
                       COLORS.warning)
                    : COLORS.textSecondary,
              }]}>
                {SAMPLE_STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  loading: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  rockType: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  date: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  coordText: { color: COLORS.textSecondary, fontSize: 13, fontFamily: 'monospace', marginVertical: 2 },
  notesText: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 20 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: { color: COLORS.textSecondary, fontSize: 14 },
  detailValue: { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  labName: { color: COLORS.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  actions: { padding: 16 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statusBtnText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
})
