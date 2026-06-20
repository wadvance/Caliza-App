import { useState, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { COLORS } from '../types/constants'
import { classifyImage, getConfidenceLabel } from '../services/mlService'
import { getCurrentLocation, calculateDistance } from '../services/locationService'
import { useAppStore } from '../store/useAppStore'

const isWeb = Platform.OS === 'web'

let NativeCameraView: any = null

if (!isWeb) {
  try {
    NativeCameraView = require('expo-camera').CameraView
  } catch {}
}

function pickImage(onCapture: (uri: string) => void, useCamera = false) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  if (useCamera) input.setAttribute('capture', 'environment')
  input.onchange = (e: any) => {
    const file = e.target?.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = ev => onCapture(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

function WebcamCapture({ onCapture }: { onCapture: (dataUri: string) => void }) {
  const [error, setError] = useState('')

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 40 }}>
      {error ? (
        <>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={{ color: COLORS.highlight, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
        </>
      ) : (
        <>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>📷</Text>
          <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Escanear roca</Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            Apunta la cámara a la roca o afloramiento para analizarla con IA
          </Text>
        </>
      )}

      <TouchableOpacity style={styles.webSelectBtn} onPress={() => {
        try {
          pickImage(onCapture, true)
        } catch {
          setError('No se pudo abrir la cámara. Usa la opción de galería.')
        }
      }}>
        <Text style={styles.webSelectText}>Tomar foto con la cámara</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 12, padding: 8 }} onPress={() => pickImage(onCapture, false)}>
        <Text style={{ color: COLORS.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>Seleccionar de galería</Text>
      </TouchableOpacity>
    </View>
  )
}

export function CameraScreen({ navigation }: any) {
  const [capturedUri, setCapturedUri] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [prediction, setPrediction] = useState<any>(null)
  const [scanLocation, setScanLocation] = useState<any>(null)
  const [nearbyCount, setNearbyCount] = useState(0)
  const cameraRef = useRef<any>(null)
  const { setLastPrediction, samples } = useAppStore()
  const isCaliza = prediction?.className?.toLowerCase() === 'caliza'

  useFocusEffect(
    useCallback(() => {
      return () => {
        setCapturedUri(null)
        setPrediction(null)
        setAnalyzing(false)
        setScanLocation(null)
        setNearbyCount(0)
      }
    }, [])
  )

  const afterClassify = useCallback(async (result: any) => {
    setPrediction(result)
    setLastPrediction(result)
    setAnalyzing(false)
    const loc = await getCurrentLocation()
    setScanLocation(loc)
    if (result?.className?.toLowerCase() === 'caliza') {
      const count = samples.filter(s =>
        s.estimatedRockType === 'caliza' &&
        calculateDistance(loc.latitude, loc.longitude, s.latitude, s.longitude) < 1
      ).length
      setNearbyCount(count)
    }
  }, [samples])

  const takePhoto = useCallback(async () => {
    if (isWeb) return
    if (!cameraRef.current) return
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
    if (photo) {
      setCapturedUri(photo.uri)
      setAnalyzing(true)
      const result = await classifyImage(photo.uri)
      afterClassify(result)
    }
  }, [afterClassify])

  const registerSample = () => {
    if (capturedUri && prediction) {
      navigation.navigate('RegisterSample', {
        photoUri: capturedUri,
        prediction,
      })
    }
  }

  const retakePhoto = () => {
    setCapturedUri(null)
    setPrediction(null)
    setScanLocation(null)
    setNearbyCount(0)
  }

  if (capturedUri) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={retakePhoto}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Image source={{ uri: capturedUri }} style={styles.preview} />
        {analyzing ? (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color={COLORS.highlight} />
            <Text style={styles.analyzingText}>Analizando roca...</Text>
          </View>
        ) : prediction ? (
          <View style={styles.resultPanel}>
            <Text style={styles.resultTitle}>Resultado preliminar</Text>
            <Text style={styles.rockClass}>{prediction.className.replace('_', ' ')}</Text>

            <View style={styles.probabilityBar}>
              <View style={[styles.barFill, { width: `${(prediction.probability * 100).toFixed(0)}%`, backgroundColor: COLORS.probabilityHigh }]} />
            </View>
            <Text style={styles.probabilityText}>
              {getConfidenceLabel(prediction.probability)}: {(prediction.probability * 100).toFixed(0)}%
            </Text>

            {prediction.allProbabilities && (
              <View style={styles.breakdown}>
                {Object.entries(prediction.allProbabilities)
                  .sort(([, a]: any, [, b]: any) => b - a)
                  .slice(0, 3)
                  .map(([name, prob]: [string, any]) => (
                    <View key={name} style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>{name}</Text>
                      <View style={styles.breakdownBarBg}>
                        <View style={[styles.breakdownBarFill, { width: `${(prob * 100).toFixed(0)}%` }]} />
                      </View>
                      <Text style={styles.breakdownValue}>{(prob * 100).toFixed(0)}%</Text>
                    </View>
                  ))}
              </View>
            )}

            <Text style={styles.recommendationTitle}>Recomendación:</Text>
            {prediction.recommendations?.map((r: string, i: number) => (
              <Text key={i} style={styles.recommendation}>• {r}</Text>
            ))}

            {isCaliza && scanLocation && (
              <View style={styles.calizaInfo}>
                <Text style={styles.calizaInfoTitle}>📍 Información de caliza</Text>
                <View style={styles.calizaInfoRow}>
                  <Text style={styles.calizaInfoLabel}>Calidad estimada:</Text>
                  <Text style={[
                    styles.calizaInfoValue,
                    { color: prediction.probability >= 0.7 ? '#4ecdc4' : prediction.probability >= 0.4 ? '#f39c12' : '#e74c3c' }
                  ]}>
                    {prediction.probability >= 0.7 ? 'Alta' : prediction.probability >= 0.4 ? 'Media' : 'Baja'}
                    {' · '}{(prediction.probability * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.calizaInfoRow}>
                  <Text style={styles.calizaInfoLabel}>Elevación:</Text>
                  <Text style={styles.calizaInfoValue}>{scanLocation.altitude.toFixed(1)} m s.n.m.</Text>
                </View>
                <View style={styles.calizaInfoRow}>
                  <Text style={styles.calizaInfoLabel}>Calizas cercanas:</Text>
                  <Text style={styles.calizaInfoValue}>{nearbyCount} en ≤1 km</Text>
                </View>
                <TouchableOpacity style={styles.calizaSearchBtn} onPress={() => navigation?.navigate('AR')}>
                  <Text style={styles.calizaSearchBtnText}>Buscar caliza cercana en AR →</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.retakeBtn} onPress={retakePhoto}>
                <Text style={styles.retakeText}>Repetir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.registerBtn} onPress={registerSample}>
                <Text style={styles.registerText}>Registrar muestra</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  if (isWeb || !NativeCameraView) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Mapa')}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <WebcamCapture onCapture={(uri) => {
          setCapturedUri(uri)
          setAnalyzing(true)
          classifyImage(uri).then(result => {
            afterClassify(result)
          })
        }} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <NativeCameraView ref={cameraRef} style={styles.camera} facing="back" ratio="4:3">
        <View style={styles.cameraOverlay}>
          <View style={styles.scanFrame}>
            <Text style={styles.scanHint}>Encuadra la roca o afloramiento</Text>
          </View>
          <View style={styles.cameraFooter}>
            <Text style={styles.footerHint}>Toca el botón para analizar</Text>
            <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </View>
      </NativeCameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  backBtn: { position: 'absolute', top: 50, left: 16, zIndex: 10, padding: 8 },
  backArrow: { color: '#fff', fontSize: 28, fontWeight: '600' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', paddingBottom: 40 },
  scanFrame: { flex: 1, justifyContent: 'center', alignItems: 'center', margin: 40, borderWidth: 2, borderColor: COLORS.highlight, borderRadius: 16, borderStyle: 'dashed' },
  scanHint: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  cameraFooter: { alignItems: 'center', paddingBottom: 20 },
  footerHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  preview: { flex: 1 },
  analyzingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  analyzingText: { color: '#fff', fontSize: 16, marginTop: 12 },
  resultPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '60%' },
  resultTitle: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  rockClass: { color: COLORS.text, fontSize: 26, fontWeight: '700', textTransform: 'capitalize', marginBottom: 8 },
  probabilityBar: { height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceLight, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', borderRadius: 4 },
  probabilityText: { color: COLORS.highlight, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  breakdown: { gap: 6, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { color: COLORS.textSecondary, fontSize: 13, width: 70, textTransform: 'capitalize' },
  breakdownBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceLight, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.accent },
  breakdownValue: { color: COLORS.text, fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right' },
  recommendationTitle: { color: COLORS.accent, fontSize: 13, fontWeight: '700', marginBottom: 4, marginTop: 4 },
  recommendation: { color: COLORS.textSecondary, fontSize: 12, marginVertical: 1 },
  calizaInfo: { marginTop: 12, backgroundColor: 'rgba(78,205,196,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(78,205,196,0.25)' },
  calizaInfoTitle: { color: '#4ecdc4', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  calizaInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  calizaInfoLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  calizaInfoValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  calizaSearchBtn: { marginTop: 10, backgroundColor: '#4ecdc4', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  calizaSearchBtnText: { color: '#1a1a2e', fontSize: 14, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  retakeBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  retakeText: { color: COLORS.text, fontWeight: '600' },
  registerBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: COLORS.accent, alignItems: 'center' },
  registerText: { color: '#fff', fontWeight: '700' },
  webSelectBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  webSelectText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
