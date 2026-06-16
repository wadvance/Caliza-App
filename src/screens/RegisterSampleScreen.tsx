import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { COLORS, ROCK_TYPES, ACID_REACTION_LABELS } from '../types/constants'
import { getCurrentLocation } from '../services/locationService'
import { saveSample } from '../services/database'
import { useAppStore } from '../store/useAppStore'
import { PhotoGrid } from '../components/PhotoGrid'
import { Sample, MLPrediction, AcidReaction } from '../types'

const generateCode = () => {
  const date = new Date()
  const prefix = 'GC'
  const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  return `${prefix}-${dateStr}-${seq}`
}

export function RegisterSampleScreen({ route, navigation }: any) {
  const photoUri = route.params?.photoUri
  const prediction: MLPrediction | undefined = route.params?.prediction

  const { addSample } = useAppStore()
  const [saving, setSaving] = useState(false)
  const [sampleCode, setSampleCode] = useState(generateCode())
  const [photos, setPhotos] = useState<string[]>(photoUri ? [photoUri] : [])
  const [notes, setNotes] = useState('')
  const [rockType, setRockType] = useState(prediction?.className || 'desconocido')
  const [depth, setDepth] = useState('')
  const [acidReaction, setAcidReaction] = useState<AcidReaction>('nula')
  const [hardness, setHardness] = useState('')
  const [color, setColor] = useState('')
  const [texture, setTexture] = useState('')
  const [stratification, setStratification] = useState('')
  const [fossilPresence, setFossilPresence] = useState(false)
  const [operatorName, setOperatorName] = useState('')
  const [location, setLocation] = useState({ latitude: 0, longitude: 0, altitude: 0 })

  useEffect(() => {
    getCurrentLocation().then(setLocation)
  }, [])

  const handleSave = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'Debe tomar al menos una foto')
      return
    }

    setSaving(true)
    try {
      const sample: Sample = {
        id: `sample_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        photoUri: photos,
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude,
        operatorName,
        timestamp: Date.now(),
        notes: `[${sampleCode}] ${notes}`,
        estimatedRockType: rockType as Sample['estimatedRockType'],
        quickTestResult: {
          acidReaction,
          hardness: parseFloat(hardness) || 0,
          color,
          texture,
          stratification,
          fossilPresence,
          estimatedCaCO3: acidReaction === 'vigorosa' ? 90 : acidReaction === 'moderada' ? 70 : acidReaction === 'leve' ? 40 : 0,
        },
        confidenceLevel: prediction?.probability || 0.5,
        status: 'pendiente',
        synced: false,
      }

      await saveSample(sample)
      addSample(sample)
      Alert.alert('Muestra registrada', `Código: ${sampleCode}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar la muestra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Registrar muestra</Text>

      <View style={styles.codeRow}>
        <Text style={styles.codeLabel}>Código:</Text>
        <Text style={styles.codeValue}>{sampleCode}</Text>
        <TouchableOpacity onPress={() => setSampleCode(generateCode())}>
          <Text style={styles.codeRefresh}>↻</Text>
        </TouchableOpacity>
      </View>

      <PhotoGrid photos={photos} onAddPhoto={() => {}} onRemovePhoto={(i) => setPhotos(p => p.filter((_, idx) => idx !== i))} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación</Text>
        <Text style={styles.coords}>
          Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
        </Text>
        <Text style={styles.coords}>Altitud: {location.altitude.toFixed(1)} m</Text>
        <TextInput style={styles.input} placeholder="Profundidad (m)" placeholderTextColor={COLORS.textMuted} value={depth} onChangeText={setDepth} keyboardType="decimal-pad" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información general</Text>
        <TextInput style={styles.input} placeholder="Nombre del operador" placeholderTextColor={COLORS.textMuted} value={operatorName} onChangeText={setOperatorName} />
        <Text style={styles.label}>Tipo de material</Text>
        <View style={styles.rockGrid}>
          {ROCK_TYPES.map(r => (
            <TouchableOpacity key={r.id} style={[styles.rockChip, rockType === r.id && { backgroundColor: r.color + '40', borderColor: r.color }]} onPress={() => setRockType(r.id)}>
              <Text style={[styles.rockChipText, rockType === r.id && { color: r.color }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[styles.input, styles.notesInput]} placeholder="Observaciones de campo" placeholderTextColor={COLORS.textMuted} value={notes} onChangeText={setNotes} multiline />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pruebas rápidas</Text>
        <Text style={styles.label}>Reacción con HCl diluido</Text>
        {Object.entries(ACID_REACTION_LABELS).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.option, acidReaction === key && styles.optionSelected]} onPress={() => setAcidReaction(key as AcidReaction)}>
            <View style={[styles.radio, acidReaction === key && styles.radioSelected]} />
            <Text style={styles.optionText}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TextInput style={styles.input} placeholder="Dureza (escala de Mohs 1-10)" placeholderTextColor={COLORS.textMuted} value={hardness} onChangeText={setHardness} keyboardType="decimal-pad" />
        <TextInput style={styles.input} placeholder="Color" placeholderTextColor={COLORS.textMuted} value={color} onChangeText={setColor} />
        <TextInput style={styles.input} placeholder="Textura" placeholderTextColor={COLORS.textMuted} value={texture} onChangeText={setTexture} />
        <TextInput style={styles.input} placeholder="Estratificación" placeholderTextColor={COLORS.textMuted} value={stratification} onChangeText={setStratification} />
        <TouchableOpacity style={[styles.option, fossilPresence && styles.optionSelected]} onPress={() => setFossilPresence(!fossilPresence)}>
          <View style={[styles.checkbox, fossilPresence && styles.checkboxSelected]}>
            {fossilPresence && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.optionText}>Presencia de fósiles</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && styles.savingBtn]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar muestra</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', padding: 16, paddingTop: 20 },
  codeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  codeLabel: { color: COLORS.textSecondary, fontSize: 14 },
  codeValue: { color: COLORS.highlight, fontSize: 16, fontWeight: '700', fontFamily: 'monospace', marginHorizontal: 8 },
  codeRefresh: { color: COLORS.accent, fontSize: 20 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 12 },
  coords: { color: COLORS.textSecondary, fontSize: 13, fontFamily: 'monospace', marginVertical: 2 },
  input: { backgroundColor: COLORS.surfaceLight, color: COLORS.text, borderRadius: 10, padding: 14, fontSize: 15, marginTop: 8, borderWidth: 1, borderColor: COLORS.border },
  notesInput: { height: 80, textAlignVertical: 'top' },
  rockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rockChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight },
  rockChipText: { color: COLORS.textSecondary, fontSize: 13 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  optionSelected: { backgroundColor: COLORS.surfaceLight, borderRadius: 8 },
  optionText: { color: COLORS.text, fontSize: 14, flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.textMuted, justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '40' },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: COLORS.textMuted, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.accent, margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  savingBtn: { opacity: 0.7 },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
