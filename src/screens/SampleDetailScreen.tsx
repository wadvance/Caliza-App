import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { COLORS, SAMPLE_STATUS_LABELS } from '../types/constants'
import { getSampleById, saveSampleWithHistory, getSampleHistory, formatFieldLabel } from '../services/database'
import type { HistoryEntry } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { PhotoGrid } from '../components/PhotoGrid'
import { EditableSection } from '../components/EditableSection'
import { ProbabilityBadge } from '../components/ProbabilityBadge'
import { Sample } from '../types'

export function SampleDetailScreen({ route, navigation }: any) {
  const { sampleId } = route.params
  const { updateSample } = useAppStore()
  const [sample, setSample] = useState<Sample | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const loadSample = useCallback(async () => {
    const data = await getSampleById(sampleId)
    setSample(data)
    if (data) {
      const h = await getSampleHistory(sampleId)
      setHistory(h)
    }
  }, [sampleId])

  useEffect(() => {
    loadSample()
  }, [loadSample])

  const handleSaveQuickTest = async (values: Record<string, string | boolean>) => {
    if (!sample) return
    const prev = { ...sample }
    const updated: Sample = {
      ...sample,
      quickTestResult: {
        acidReaction: values.acidReaction as any || sample.quickTestResult?.acidReaction || 'nula',
        hardness: Number(values.hardness) || sample.quickTestResult?.hardness || 0,
        color: String(values.color || ''),
        texture: String(values.texture || ''),
        stratification: String(values.stratification || ''),
        fossilPresence: Boolean(values.fossilPresence),
        estimatedCaCO3: values.estimatedCaCO3 ? Number(values.estimatedCaCO3) : undefined,
      },
    }
    await saveSampleWithHistory(updated, prev)
    updateSample(sample.id, updated)
    setSample(updated)
    const h = await getSampleHistory(sampleId)
    setHistory(h)
  }

  const handleSaveNotes = async (values: Record<string, string | boolean>) => {
    if (!sample) return
    const prev = { ...sample }
    const updated: Sample = { ...sample, notes: String(values.notes || '') }
    await saveSampleWithHistory(updated, prev)
    updateSample(sample.id, updated)
    setSample(updated)
    const h = await getSampleHistory(sampleId)
    setHistory(h)
  }

  const handleSaveOperator = async (values: Record<string, string | boolean>) => {
    if (!sample) return
    const prev = { ...sample }
    const updated: Sample = { ...sample, operatorName: String(values.operatorName || '') }
    await saveSampleWithHistory(updated, prev)
    updateSample(sample.id, updated)
    setSample(updated)
    const h = await getSampleHistory(sampleId)
    setHistory(h)
  }

  const changeStatus = async (newStatus: Sample['status']) => {
    if (!sample) return
    const prev = { ...sample }
    const updated: Sample = { ...sample, status: newStatus }
    await saveSampleWithHistory(updated, prev)
    updateSample(sample.id, { status: newStatus })
    setSample(updated)
    const h = await getSampleHistory(sampleId)
    setHistory(h)
  }

  if (!sample) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Cargando...</Text>
      </View>
    )
  }

  const quickTestFields = [
    { label: 'Reacción HCl', key: 'acidReaction', value: sample.quickTestResult?.acidReaction || 'nula' },
    { label: 'Dureza (escala 1-10)', key: 'hardness', value: String(sample.quickTestResult?.hardness ?? ''), type: 'number' as const },
    { label: 'Color', key: 'color', value: sample.quickTestResult?.color || '' },
    { label: 'Textura', key: 'texture', value: sample.quickTestResult?.texture || '' },
    { label: 'Estratificación', key: 'stratification', value: sample.quickTestResult?.stratification || '' },
    { label: 'Presencia de fósiles', key: 'fossilPresence', value: !!sample.quickTestResult?.fossilPresence, type: 'switch' as const },
    { label: 'CaCO₃ estimado (%)', key: 'estimatedCaCO3', value: String(sample.quickTestResult?.estimatedCaCO3 ?? ''), type: 'number' as const },
  ]

  const notesField = [
    { label: 'Observaciones', key: 'notes', value: sample.notes || '', type: 'multiline' as const },
  ]

  const operatorField = [
    { label: 'Operador', key: 'operatorName', value: sample.operatorName || '' },
  ]

  const isStatusActive = (status: string) => sample.status === status

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhotoGrid photos={sample.photoUri} readonly />

      <View style={styles.header}>
        <View>
          <Text style={styles.rockType}>{sample.estimatedRockType}</Text>
          <Text style={styles.date}>
            {new Date(sample.timestamp).toLocaleString('es-MX', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
        <ProbabilityBadge
          probability={
            sample.confidenceLevel > 0.6 ? 'alta' :
            sample.confidenceLevel > 0.3 ? 'media' : 'baja'
          }
          size="medium"
        />
      </View>

      <EditableSection
        title="Operador"
        fields={operatorField}
        onSave={handleSaveOperator}
      />

      <EditableSection
        title="Observaciones"
        fields={notesField}
        onSave={handleSaveNotes}
      />

      {sample.quickTestResult && (
        <EditableSection
          title="Pruebas rápidas"
          fields={quickTestFields}
          onSave={handleSaveQuickTest}
        />
      )}

      {sample.labResult && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resultados de laboratorio</Text>
          {([
            { label: 'CaCO₃', value: `${sample.labResult.caco3Purity}%` },
            { label: 'MgO', value: `${sample.labResult.mgo}%` },
            { label: 'SiO₂', value: `${sample.labResult.sio2}%` },
            { label: 'Al₂O₃', value: `${sample.labResult.al2o3}%` },
            { label: 'Fe₂O₃', value: `${sample.labResult.fe2o3}%` },
            { label: 'LOI', value: `${sample.labResult.loi}%` },
          ] as const).map(({ label, value }) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
          <Text style={styles.labName}>
            Laboratorio: {sample.labResult.laboratoryName} — {new Date(sample.labResult.date).toLocaleDateString()}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coordenadas</Text>
        <Text style={styles.coordText}>
          {sample.latitude.toFixed(6)}, {sample.longitude.toFixed(6)}
        </Text>
        <Text style={styles.coordText}>Altitud: {sample.altitude.toFixed(1)} m s.n.m.</Text>
        <Text style={styles.coordText}>ID: {sample.id.slice(0, 8)}...</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado</Text>
        <View style={styles.statusRow}>
          {(['pendiente', 'validado', 'descartado'] as const).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusBtn,
                isStatusActive(status) && {
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
                color: isStatusActive(status)
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

      {/* History */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.historyHeader}
          onPress={() => setShowHistory(!showHistory)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>Historial de cambios</Text>
          <Text style={styles.historyToggle}>{showHistory ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showHistory && (
          history.length === 0 ? (
            <Text style={styles.emptyHistory}>Sin cambios registrados</Text>
          ) : (
            history.map(entry => (
              <View key={entry.id} style={styles.historyEntry}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyField}>
                    {formatFieldLabel(entry.field)}
                  </Text>
                  <Text style={styles.historyChange} numberOfLines={2}>
                    {entry.oldValue || '(vacío)'} → {entry.newValue || '(vacío)'}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(entry.timestamp).toLocaleString('es-MX', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )
        )}
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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

  // History
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyToggle: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  emptyHistory: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  historyEntry: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginTop: 4,
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyField: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  historyChange: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  historyDate: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
})
