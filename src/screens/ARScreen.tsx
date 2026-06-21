import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, FlatList, Platform } from 'react-native'
import { COLORS } from '../types/constants'
import { useCurrentLocation, calculateBearing, calculateDistance } from '../services/locationService'
import { getAllZones, saveSample } from '../services/database'
import { Sample, CalizaZone } from '../types'
import { useAppStore } from '../store/useAppStore'
import * as THREE from 'three'

const isWeb = Platform.OS === 'web'

// Web camera component using DOM video element
let CameraView: any = View
if (isWeb) {
  const WebCam = ({ children, style }: any) => {
    const [started, setStarted] = useState(false)
    const [error, setError] = useState('')
    const containerRef = useRef<any>(null)
    const startCam = () => {
      if (started) return
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu navegador no soporta la cámara. Usa Chrome o Safari.')
        return
      }
      const api = (window as any).DeviceOrientationEvent
      if (api?.requestPermission) api.requestPermission().catch(() => {})
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
        .then(stream => {
          setStarted(true)
          if (!containerRef.current) return
          const existing = document.getElementById('ar-video')
          if (existing) existing.remove()
          const video = document.createElement('video')
          video.id = 'ar-video'
          video.setAttribute('autoplay', '')
          video.setAttribute('playsinline', '')
          video.srcObject = stream
          video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;border-radius:inherit'
          containerRef.current.style.background = 'transparent'
          containerRef.current.prepend(video)
        })
        .catch((err) => {
          const msg = err.name + ': ' + (err.message || '')
          setError(msg)
        })
    }
    return React.createElement('div', {
      ref: containerRef,
      style: {
        flex: 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden',
        width: '100%', height: '100%',
      }
    },
      !started
        ? React.createElement('button', {
            onClick: startCam,
            style: {
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 10, background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#fff', fontSize: 18, padding: '20px 40px',
            }
          }, error || 'Toca para iniciar AR')
        : null,
      React.createElement('div', {
        style: { zIndex: 1, position: 'relative', width: '100%', height: '100%' }
      }, children)
    )
  }
  CameraView = WebCam
} else {
  try {
    CameraView = require('expo-camera').CameraView
  } catch {}
}

// Smooth heading with exponential moving average
let smoothedHeading = 0
let headingInitialized = false
function smoothHeading(raw: number, alpha = 0.25): number {
  if (!headingInitialized) {
    smoothedHeading = raw
    headingInitialized = true
    return raw
  }
  let diff = raw - smoothedHeading
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  smoothedHeading = ((smoothedHeading + diff * alpha) % 360 + 360) % 360
  return smoothedHeading
}

const getZoneColor = (prob: string) => {
  switch (prob) {
    case 'alta': return COLORS.probabilityHigh
    case 'media': return COLORS.probabilityMedium
    case 'baja': return COLORS.probabilityLow
    default: return COLORS.probabilityPending
  }
}

interface ARTarget {
  id: string
  name: string
  latitude: number
  longitude: number
  distance: number
  bearing: number
  type: 'sample' | 'zone'
  color: string
}

function ScanModeView({ samples, location }: { samples: any[]; location: any }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<{
    isCaliza: boolean; confidence: number; details: string;
    tipo: string; calidad: string; porcentaje: number;
  } | null>(null)
  const [acidTest, setAcidTest] = useState<'vigorosa' | 'moderada' | 'leve' | 'nula' | null>(null)
  const canvasRef = useRef<any>(null)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')

  const getCalidad = (pct: number) => pct >= 90 ? 'Alta' : pct >= 70 ? 'Media' : 'Baja'

  const saveDetection = (tipo: string, calidad: string, porcentaje: number, confidence: number, isCaliza: boolean) => {
    if (!location) return
    const rockType = tipo.toLowerCase().includes('caliza') || tipo.toLowerCase().includes('marga') ? 'caliza'
      : tipo.toLowerCase().includes('arcilla') ? 'arcilla'
      : tipo.toLowerCase().includes('yeso') ? 'yeso'
      : tipo.toLowerCase().includes('dolomita') ? 'dolomita'
      : tipo.toLowerCase().includes('travertino') ? 'travertino'
      : tipo.toLowerCase().includes('basalto') ? 'basalto'
      : tipo.toLowerCase().includes('granito') ? 'granito'
      : 'desconocido'
    const sample: Sample = {
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      photoUri: [],
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: 0,
      operatorName: 'Escáner AR',
      timestamp: Date.now(),
      notes: `AR scan: ${tipo} (${calidad}, ${porcentaje}% CaCO₃)`,
      estimatedRockType: rockType as any,
      confidenceLevel: confidence / 100,
      status: isCaliza ? 'validado' : 'pendiente',
      synced: false,
    }
    saveSample(sample).catch(() => {})
    useAppStore.getState().addSample(sample)
  }

  const captureAndAnalyze = () => {
    setAnalyzing(true)
    setResult(null)
    setAcidTest(null)
    setTimeout(() => {
      try {
        const video = document.getElementById('ar-video') as HTMLVideoElement
        if (!video || !video.videoWidth) {
          setResult({ isCaliza: false, confidence: 0, details: 'No se pudo acceder a la cámara. Usa el modo manual.', tipo: 'N/A', calidad: 'N/A', porcentaje: 0 })
          setAnalyzing(false)
          return
        }
        const c = document.createElement('canvas')
        c.width = video.videoWidth
        c.height = video.videoHeight
        const ctx = c.getContext('2d')
        if (!ctx) { setAnalyzing(false); return }
        ctx.drawImage(video, 0, 0)

        const cx = Math.floor(c.width / 2), cy = Math.floor(c.height / 2)
        const size = Math.min(c.width, c.height) * 0.15
        const region = ctx.getImageData(cx - size, cy - size, size * 2, size * 2)
        const data = region.data

        let r = 0, g = 0, b = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
        }
        r /= count; g /= count; b /= count

        const brightness = (r + g + b) / 3 / 255
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b)
        const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC
        const redRatio = r / (r + g + b + 1)
        const greenRatio = g / (r + g + b + 1)

        let isCaliza = false
        let confidence = 0
        let details = ''
        let tipo = 'No determinado'
        let porcentaje = 0

        if (brightness > 0.65 && saturation < 0.15 && redRatio > 0.34 && redRatio < 0.42 && greenRatio > 0.33) {
          isCaliza = true
          confidence = Math.min(92, Math.round((brightness - 0.6) * 100 + (0.15 - saturation) * 100 + (redRatio > 0.36 ? 20 : 0)))
          const basePct = 85 + Math.round((brightness - 0.6) * 50)
          porcentaje = Math.min(99, basePct)
          tipo = porcentaje >= 95 ? 'Caliza micrítica (CaCO₃ puro)' : 'Caliza esparítica'
          details = `Brillo: ${(brightness * 100).toFixed(0)}%, Saturación: ${(saturation * 100).toFixed(0)}%`
        } else if (brightness > 0.55 && saturation < 0.25 && redRatio > 0.32 && redRatio < 0.44) {
          isCaliza = true
          confidence = Math.min(80, Math.round((brightness - 0.5) * 60 + (0.25 - saturation) * 50 + 20))
          porcentaje = 65 + Math.round((brightness - 0.5) * 40)
          tipo = 'Caliza arcillosa (marga)'
          details = `Color fuera de rango típico. Brillo: ${(brightness * 100).toFixed(0)}%`
        } else {
          isCaliza = false
          confidence = Math.min(98, Math.round(
            (brightness < 0.55 ? 30 : 0) +
            (saturation > 0.2 ? 35 : 0) +
            (redRatio < 0.3 || redRatio > 0.46 ? 25 : 0)
          ))
          porcentaje = Math.round(redRatio * 100)
          tipo = brightness < 0.55 ? 'Roca oscura (posible basalto/lutita)'
            : saturation > 0.2 ? 'Roca ferruginosa (óxidos de hierro)'
            : 'Roca silícea (cuarzo/arenisca)'
          const reasons = []
          if (brightness < 0.55) reasons.push('muy oscuro')
          if (saturation > 0.2) reasons.push('muy saturado')
          if (redRatio < 0.3) reasons.push('poco rojo')
          if (redRatio > 0.46) reasons.push('muy rojo')
          details = reasons.length ? `Razones: ${reasons.join(', ')}` : 'No coincide con caliza'
        }

        setResult({ isCaliza, confidence, details, tipo, calidad: getCalidad(porcentaje), porcentaje })
        saveDetection(tipo, getCalidad(porcentaje), porcentaje, confidence, isCaliza)
      } catch (e) {
        setResult({ isCaliza: false, confidence: 0, details: 'Error al analizar. Usa el modo manual.', tipo: 'N/A', calidad: 'N/A', porcentaje: 0 })
      }
      setAnalyzing(false)
    }, 300)
  }

  // --- Manual identification sub-mode ---
  const [prop1, setProp1] = useState<string | null>(null)
  const [prop2, setProp2] = useState<string | null>(null)
  const [prop3, setProp3] = useState<string | null>(null)

  const manualInfo = !prop1 ? null
    : prop1 === 'clara' && prop2 === 'suave'
      ? { tipo: 'Caliza micrítica (CaCO₃ puro)', calidad: 'Alta', porcentaje: 97 }
    : prop1 === 'clara' && prop2 === 'dura'
      ? { tipo: 'Caliza esparítica', calidad: 'Alta', porcentaje: 93 }
    : prop1 === 'clara' && prop3 === 'si'
      ? { tipo: 'Caliza arcillosa', calidad: 'Media', porcentaje: 82 }
    : prop1 === 'clara' && prop3 === 'no'
      ? { tipo: 'Yeso (CaSO₄)', calidad: 'N/A', porcentaje: 0 }
    : prop1 === 'media' && prop2 === 'suave'
      ? { tipo: 'Marga', calidad: 'Baja', porcentaje: 45 }
    : prop1 === 'media' && prop2 === 'porosa'
      ? { tipo: 'Travertino', calidad: 'Media', porcentaje: 75 }
    : prop1 === 'media' && prop3 === 'no'
      ? { tipo: 'Caliche', calidad: 'Baja', porcentaje: 35 }
    : prop1 === 'oscura' && prop2 === 'dura'
      ? { tipo: 'Basalto', calidad: 'N/A', porcentaje: 0 }
    : prop1 === 'oscura' && prop2 === 'suave'
      ? { tipo: 'Arcilla', calidad: 'N/A', porcentaje: 0 }
    : prop1 === 'oscura'
      ? { tipo: 'Roca oscura no calcárea', calidad: 'N/A', porcentaje: 0 }
    : prop1 === 'clara'
      ? { tipo: 'Caliza (tipo no especificado)', calidad: 'Media', porcentaje: 85 }
    : prop1 === 'media'
      ? { tipo: 'Roca sedimentaria mixta', calidad: 'Baja', porcentaje: 40 }
    : { tipo: 'Tipo no determinado', calidad: 'N/A', porcentaje: 0 }

  // Save manual detection when identified
  React.useEffect(() => {
    if (manualInfo && prop1) {
      const isCal = manualInfo.tipo.includes('Caliza') || manualInfo.tipo.includes('Marga') || manualInfo.tipo.includes('Travertino') || manualInfo.tipo.includes('Caliche')
      saveDetection(manualInfo.tipo, manualInfo.calidad, manualInfo.porcentaje, isCal ? 80 : 30, isCal)
    }
  }, [prop1, prop2, prop3]) // eslint-disable-line

  const isManualCaliza = manualInfo && (manualInfo.tipo.includes('Caliza') || manualInfo.tipo.includes('Marga') || manualInfo.tipo.includes('Travertino') || manualInfo.tipo.includes('Caliche'))
  const manualResult = manualInfo?.tipo || null

  const manualReset = () => { setProp1(null); setProp2(null); setProp3(null) }

  const row = (label: string, options: { value: string; label: string }[], selected: string | null, set: (v: string) => void) => (
    React.createElement(View, { style: scanStyles.row, key: label },
      React.createElement(Text, { style: scanStyles.label }, label),
      React.createElement(View, { style: scanStyles.options },
        ...options.map(o =>
          React.createElement(TouchableOpacity, {
            key: o.value,
            onPress: () => set(o.value),
            style: [scanStyles.opt, selected === o.value && scanStyles.optSel]
          },
            React.createElement(Text, { style: [scanStyles.optText, selected === o.value && scanStyles.optTextSel] }, o.label)
          )
        )
      )
    )
  )

  const resultCard = (r: typeof result) => {
    const color = r.isCaliza ? '#2ecc71' : '#e74c3c'
    return React.createElement(View, { style: [scanStyles.analysisResult, { borderColor: color }] },
      React.createElement(Text, { style: [scanStyles.analysisIcon] }, r.isCaliza ? '✅' : '❌'),
      React.createElement(Text, { style: [scanStyles.analysisTitle, { color }] },
        r.isCaliza ? 'CALIZA DETECTADA' : 'NO ES CALIZA'
      ),
      React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 4 } },
        React.createElement(View, { style: { alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#aaa', fontSize: 9 } }, 'TIPO'),
          React.createElement(Text, { style: { color: '#fff', fontSize: 10, fontWeight: '600', textAlign: 'center' } }, r.tipo),
        ),
        React.createElement(View, { style: { alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#aaa', fontSize: 9 } }, 'CALIDAD'),
          React.createElement(Text, { style: { color: r.calidad === 'Alta' ? '#2ecc71' : r.calidad === 'Media' ? '#f39c12' : '#e74c3c', fontSize: 12, fontWeight: '700' } }, r.calidad),
        ),
        React.createElement(View, { style: { alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#aaa', fontSize: 9 } }, 'CaCO\u2083*'),
          React.createElement(Text, { style: { color: '#fff', fontSize: 12, fontWeight: '700' } }, `${r.porcentaje}%`),
        ),
      ),
      r.confidence > 0 ? React.createElement(Text, { style: scanStyles.analysisConfidence },
        `Confianza: ${r.confidence}%`
      ) : null,
      r.details ? React.createElement(Text, { style: scanStyles.analysisDetails }, r.details) : null,

      // Acid test section
      !acidTest
        ? React.createElement(React.Fragment, null,
            React.createElement(Text, { style: { color: '#ffff00', fontSize: 10, fontWeight: '700', textAlign: 'center', marginVertical: 3 } },
              '🧪 Confirma con prueba de ácido:'
            ),
            React.createElement(View, { style: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginBottom: 3 } },
              [['vigorosa', '#2ecc71', 'Vigorosa'],
               ['moderada', '#f39c12', 'Moderada'],
               ['leve', '#e67e22', 'Leve'],
               ['nula', '#e74c3c', 'Nula']].map(([val, c, label]) =>
                React.createElement(TouchableOpacity, {
                  key: val,
                  onPress: () => setAcidTest(val as any),
                  style: { backgroundColor: c + '30', borderColor: c, borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, alignItems: 'center' }
                },
                  React.createElement(Text, { style: { color: c, fontSize: 10, fontWeight: '700', textAlign: 'center' } }, label)
                )
              )
            ),
            React.createElement(Text, { style: { color: 'rgba(255,255,255,0.4)', fontSize: 8, textAlign: 'center', marginBottom: 3 } },
              'Aplica HCl al 10% y selecciona la reacción'
            ),
          )
        : React.createElement(View, { style: { backgroundColor: '#ffff0020', borderRadius: 6, padding: 6, marginVertical: 4, width: '100%', alignItems: 'center' } },
            React.createElement(Text, { style: { fontSize: 12, fontWeight: '800', color: acidTest === 'vigorosa' || acidTest === 'moderada' ? '#2ecc71' : '#e74c3c', textAlign: 'center' } },
              acidTest === 'vigorosa' ? '✅ CALIZA CONFIRMADA' :
              acidTest === 'moderada' ? '✅ CALIZA CONFIRMADA' :
              acidTest === 'leve' ? '⚠️ MARGA — baja reacción' :
              '❌ NO ES CALIZA'
            ),
          ),

      React.createElement(Text, { style: { color: 'rgba(255,255,255,0.3)', fontSize: 8, textAlign: 'center', marginBottom: 4 } },
        '*CaCO\u2083 estimado. No reemplaza laboratorio.'
      ),
      React.createElement(TouchableOpacity, { onPress: () => { setResult(null); setAcidTest(null); captureAndAnalyze() }, style: scanStyles.analyzeBtn },
        React.createElement(Text, { style: scanStyles.analyzeText }, 'Analizar otra')
      )
    )
  }

  const manualResultCard = (info: typeof manualInfo) => {
    if (!info) return null
    const isCal = isManualCaliza
    const color = isCal ? '#2ecc71' : '#e74c3c'
    const calidadColor = info.calidad === 'Alta' ? '#2ecc71' : info.calidad === 'Media' ? '#f39c12' : '#e74c3c'
    return React.createElement(View, { style: [scanStyles.analysisResult, { borderColor: color }] },
      React.createElement(Text, { style: [scanStyles.analysisIcon] }, isCal ? '✅' : '❌'),
      React.createElement(Text, { style: [scanStyles.analysisTitle, { color }] },
        isCal ? 'POSIBLE CALIZA' : `Resultado: ${info.tipo}`
      ),
      React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 4 } },
        React.createElement(View, { style: { alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#aaa', fontSize: 9 } }, 'TIPO'),
          React.createElement(Text, { style: { color: '#fff', fontSize: 10, fontWeight: '600', textAlign: 'center' } }, info.tipo),
        ),
        React.createElement(View, { style: { alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#aaa', fontSize: 9 } }, 'CALIDAD'),
          React.createElement(Text, { style: { color: calidadColor, fontSize: 12, fontWeight: '700' } }, info.calidad),
        ),
        info.porcentaje > 0 ? React.createElement(View, { style: { alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#aaa', fontSize: 9 } }, 'CaCO\u2083*'),
          React.createElement(Text, { style: { color: '#fff', fontSize: 12, fontWeight: '700' } }, `${info.porcentaje}%`),
        ) : null,
      ),
      React.createElement(Text, { style: { color: 'rgba(255,255,255,0.3)', fontSize: 8, textAlign: 'center', marginBottom: 4 } },
        '*CaCO\u2083 estimado.'
      ),
      React.createElement(TouchableOpacity, { onPress: manualReset, style: scanStyles.resetBtn },
        React.createElement(Text, { style: scanStyles.resetText }, 'Reiniciar')
      )
    )
  }

  return React.createElement(View, { style: scanStyles.container },
    React.createElement(View, { style: scanStyles.tabRow },
      React.createElement(TouchableOpacity, { onPress: () => { setMode('auto'); setResult(null) }, style: [scanStyles.tab, mode === 'auto' && scanStyles.tabActive] },
        React.createElement(Text, { style: [scanStyles.tabText, mode === 'auto' && scanStyles.tabTextActive] }, '📷 Autom\u00e1tico')
      ),
      React.createElement(TouchableOpacity, { onPress: () => { setMode('manual'); setResult(null) }, style: [scanStyles.tab, mode === 'manual' && scanStyles.tabActive] },
        React.createElement(Text, { style: [scanStyles.tabText, mode === 'manual' && scanStyles.tabTextActive] }, '✋ Manual')
      ),
    ),

    mode === 'auto' ? React.createElement(React.Fragment, null,
      React.createElement(Text, { style: scanStyles.title }, 'Esc\u00e1ner de Caliza'),
      React.createElement(Text, { style: scanStyles.sub }, 'Apunta la c\u00e1mara a la roca y presiona "Analizar"'),

      result ? resultCard(result)
      : React.createElement(View, { style: scanStyles.viewfinder },
        React.createElement(View, { style: scanStyles.reticle }),
        React.createElement(TouchableOpacity, { onPress: captureAndAnalyze, disabled: analyzing, style: [scanStyles.analyzeBtn, analyzing && { opacity: 0.5 }] },
          React.createElement(Text, { style: scanStyles.analyzeText }, analyzing ? 'Analizando...' : 'Analizar roca')
        )
      )
    )
    : React.createElement(React.Fragment, null,
      React.createElement(Text, { style: scanStyles.title }, 'Identificaci\u00f3n manual'),
      React.createElement(Text, { style: scanStyles.sub }, 'Selecciona las propiedades:'),
      !prop1 ? row('Color', [
        { value: 'clara', label: 'Clara (beige/blanco)' },
        { value: 'media', label: 'Media (marr\u00f3n/gris)' },
        { value: 'oscura', label: 'Oscura (negra/gris oscuro)' },
      ], prop1, v => setProp1(v))
      : !prop2 ? row('Textura', [
        { value: 'suave', label: 'Suave/tiza' },
        { value: 'dura', label: 'Dura/compacta' },
        { value: 'porosa', label: 'Porosa/esponjosa' },
      ], prop2, v => setProp2(v))
      : !prop3 && (prop1 === 'clara' || prop1 === 'media') ? row('\u00bfReacciona con \u00e1cido?', [
        { value: 'si', label: 'S\u00ed (efervescencia)' },
        { value: 'no', label: 'No' },
      ], prop3, v => setProp3(v))
      : null,
      manualInfo && manualResultCard(manualInfo)
    )
  )
}

const scanStyles = StyleSheet.create({
  container: { flex: 1, padding: 12, gap: 8 },
  tabRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  tabActive: { backgroundColor: COLORS.accent },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  viewfinder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, minHeight: 200 },
  reticle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  analyzeBtn: { backgroundColor: COLORS.highlight, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  analyzeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  analysisResult: {
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, borderWidth: 2, padding: 8,
    alignItems: 'center', gap: 3, marginVertical: 6,
  },
  analysisIcon: { fontSize: 28 },
  analysisTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  analysisConfidence: { color: '#fff', fontSize: 12, fontWeight: '600' },
  analysisDetails: { color: 'rgba(255,255,255,0.6)', fontSize: 10, textAlign: 'center' },
  row: { gap: 8 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opt: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  optSel: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  optText: { color: '#fff', fontSize: 13 },
  optTextSel: { color: '#fff', fontWeight: '700' },
  result: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 12, gap: 6, marginTop: 6 },
  resetBtn: { backgroundColor: COLORS.highlight, padding: 8, borderRadius: 8, alignSelf: 'center', marginTop: 6 },
  resetText: { color: '#fff', fontSize: 13, fontWeight: '600' },
})

function makeTextSprite(text: string, color: string, fontSize: number, fontWeight: string = 'normal'): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${fontWeight} ${fontSize}px sans-serif`
  const m = ctx.measureText(text)
  canvas.width = Math.ceil(m.width + 8)
  canvas.height = Math.ceil(fontSize * 1.5)
  ctx.font = `${fontWeight} ${fontSize}px sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(canvas.width, canvas.height, 1)
  return sprite
}

function Model3DView({ heading, isWeb, location, samples }: { heading: number; isWeb: boolean; location: any; samples: any[] }) {
  const containerRef = useRef<any>(null)
  const threeRef = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer
  } | null>(null)
  const controlsRef = useRef({ theta: 0.4, phi: 0.4, dist: 7, tx: 0, ty: -1.5 })

  const calizaCheck = React.useMemo(() => {
    if (!location) return { hasCaliza: false, nearest: Infinity, source: '' }
    let nearest = Infinity
    let source = ''
    for (const s of samples) {
      if (!s || !s.latitude || !s.longitude) continue
      const dist = calculateDistance(location.latitude, location.longitude, s.latitude, s.longitude)
      if (dist < nearest && (s.estimatedRockType?.toLowerCase().includes('caliza') || s.status === 'validado')) {
        nearest = dist
        source = `${s.name || s.estimatedRockType}`
      }
    }
    return { hasCaliza: nearest < 2, nearest: Math.round(nearest * 1000) / 1000, source }
  }, [location, samples])

  useEffect(() => {
    if (!isWeb) return
    const container = containerRef.current
    if (!container) return
    const w = container.clientWidth || 320
    const h = container.clientHeight || 260

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a1a)
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 50)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)
    threeRef.current = { scene, camera, renderer }

    const al = new THREE.AmbientLight(0x404060, 0.6)
    scene.add(al)
    const dl = new THREE.DirectionalLight(0xffffff, 0.9)
    dl.position.set(5, 10, 7)
    dl.castShadow = true
    scene.add(dl)
    const dl2 = new THREE.DirectionalLight(0x88aaff, 0.3)
    dl2.position.set(-5, 3, -7)
    scene.add(dl2)

    const layers = [
      { name: 'Suelo vegetal', color: 0x5D4037, y0: 0, y1: -0.3 },
      { name: 'Arcilla', color: 0x8D6E63, y0: -0.3, y1: -0.8 },
      { name: 'Marga', color: 0xBCAAA4, y0: -0.8, y1: -1.5 },
      { name: 'Caliza', color: 0xD0D0D0, y0: -1.5, y1: -2.5 },
      { name: 'Dolomita', color: 0x9E9E9E, y0: -2.5, y1: -3.5 },
      { name: 'Basamento', color: 0x616161, y0: -3.5, y1: -5.0 },
    ]
    const bs = 2.5

    layers.forEach((layer, i) => {
      const hh = layer.y0 - layer.y1
      const geo = new THREE.BoxGeometry(bs, hh, bs)
      const mat = new THREE.MeshPhongMaterial({ color: layer.color, transparent: true, opacity: 0.88, shininess: 10 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(0, layer.y0 - hh / 2, 0)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)

      const edge = new THREE.EdgesGeometry(geo)
      const em = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.25 })
      const eg = new THREE.LineSegments(edge, em)
      eg.position.copy(mesh.position)
      scene.add(eg)

      const label = makeTextSprite(`${layer.name} (${-layer.y1}m)`, i === 3 ? '#ffff00' : '#ccc', 11)
      label.position.set(bs / 2 + 0.3, layer.y0 - hh / 2, 0)
      scene.add(label)
    })

    const grid = new THREE.GridHelper(bs * 1.5, 8, 0x4caf50, 0x4caf50)
    grid.position.set(0, 0, 0)
    scene.add(grid)

    // Caliza highlight for the caliza layer
    if (calizaCheck.hasCaliza) {
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(bs * 1.05, 1.0, bs * 1.05),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.15, wireframe: false })
      )
      glow.position.set(0, -2.0, 0)
      scene.add(glow)
    }

    let animId: number
    let isDragging = false
    let prevX = 0, prevY = 0

    const renderScene = () => {
      const c = controlsRef.current
      c.theta += isDragging ? 0 : 0.008
      camera.position.x = c.tx + c.dist * Math.sin(c.theta) * Math.cos(c.phi)
      camera.position.y = c.ty + c.dist * Math.sin(c.phi)
      camera.position.z = c.tx + c.dist * Math.cos(c.theta) * Math.cos(c.phi)
      camera.lookAt(c.tx, c.ty, 0)
      renderer.render(scene, camera)
      animId = requestAnimationFrame(renderScene)
    }
    animId = requestAnimationFrame(renderScene)

    const onDown = (x: number, y: number) => { isDragging = true; prevX = x; prevY = y }
    const onMove = (x: number, y: number) => {
      if (!isDragging) return
      const dx = x - prevX, dy = y - prevY
      controlsRef.current.theta += dx * 0.01
      controlsRef.current.phi = Math.max(-1.2, Math.min(1.2, controlsRef.current.phi + dy * 0.01))
      prevX = x; prevY = y
    }
    const onUp = () => { isDragging = false }

    renderer.domElement.addEventListener('mousedown', (e: MouseEvent) => onDown(e.clientX, e.clientY))
    window.addEventListener('mousemove', (e: MouseEvent) => onMove(e.clientX, e.clientY))
    window.addEventListener('mouseup', onUp)
    renderer.domElement.addEventListener('touchstart', (e: TouchEvent) => { const t = e.touches[0]; onDown(t.clientX, t.clientY) }, { passive: true })
    window.addEventListener('touchmove', (e: TouchEvent) => { const t = e.touches[0]; onMove(t.clientX, t.clientY) }, { passive: true })
    window.addEventListener('touchend', onUp, { passive: true })

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const nw = e.contentRect.width
        const nh = e.contentRect.height
        if (nw > 0 && nh > 0) {
          renderer.setSize(nw, nh)
          camera.aspect = nw / nh
          camera.updateProjectionMatrix()
        }
      }
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      threeRef.current = null
      window.removeEventListener('mousemove', (e: MouseEvent) => onMove(e.clientX, e.clientY))
      window.removeEventListener('mouseup', onUp)
    }
  }, [isWeb]) // eslint-disable-line

  return React.createElement(View, { style: { padding: 10, alignItems: 'center' } },
    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 6 } },
      React.createElement(Text, { style: { color: '#fff', fontSize: 16, fontWeight: '700' } }, 'Modelo 3D del subsuelo'),
      calizaCheck.hasCaliza
        ? React.createElement(Text, { style: { color: '#2ecc71', fontSize: 14, fontWeight: '700', marginLeft: 8 } }, '\u2705 Caliza detectada')
        : React.createElement(Text, { style: { color: '#e74c3c', fontSize: 14, fontWeight: '700', marginLeft: 8 } }, '\u274c Sin caliza')
    ),
    calizaCheck.source
      ? React.createElement(Text, { style: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center', marginBottom: 4 } },
          `${calizaCheck.source} a ${calizaCheck.nearest} km`
        )
      : null,
    React.createElement(View, {
      ref: containerRef,
      style: { width: '100%', maxWidth: 360, aspectRatio: 4 / 3, alignSelf: 'center', borderRadius: 10, overflow: 'hidden' }
    }),
    React.createElement(Text, { style: { color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', marginTop: 4 } },
      'Arrastra para rotar · Capas: Suelo, Arcilla, Marga, Caliza, Dolomita, Basamento'
    )
  )
}

function lighten(hex: string, pct: number): string {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (num >> 16) + pct)
  const g = Math.min(255, ((num >> 8) & 0x00FF) + pct)
  const b = Math.min(255, (num & 0x0000FF) + pct)
  return `rgb(${r},${g},${b})`
}

function ModelModeView({ heading, isWeb, location, samples }: { heading: number; isWeb: boolean; location: any; samples: any[] }) {
  const containerRef = useRef<any>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef<(() => void) | null>(null)

  const calizaCheck = React.useMemo(() => {
    if (!location) return { hasCaliza: false, nearest: Infinity, source: '' }
    let nearest = Infinity
    let source = ''
    for (const s of samples) {
      if (!s || !s.latitude || !s.longitude) continue
      const dist = calculateDistance(location.latitude, location.longitude, s.latitude, s.longitude)
      if (dist < nearest && (s.estimatedRockType?.toLowerCase().includes('caliza') || s.status === 'validado')) {
        nearest = dist
        source = `Muestra: ${s.name || s.estimatedRockType}`
      }
    }
    return { hasCaliza: nearest < 2, nearest: Math.round(nearest * 1000) / 1000, source }
  }, [location, samples])

  // Collect rock types from nearby samples
  const localTypes = React.useMemo(() => {
    if (!location) return new Set<string>()
    const types = new Set<string>()
    for (const s of samples) {
      if (!s || !s.latitude || !s.longitude) continue
      const dist = calculateDistance(location.latitude, location.longitude, s.latitude, s.longitude)
      if (dist < 5 && s.estimatedRockType) types.add(s.estimatedRockType.toLowerCase())
    }
    return types
  }, [location, samples])

  useEffect(() => {
    if (!isWeb) return
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block;border-radius:8px'
    container.appendChild(canvas)
    canvasRef.current = canvas

    const draw = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = rect.width
      const h = rect.height
      if (w < 1 || h < 1) return
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      const margin = { top: 10, bottom: 14, left: 42, right: 90 }
      const colX = margin.left
      const colW = w - margin.left - margin.right
      const colY = margin.top
      const colH = h - margin.top - margin.bottom

      // Background
      ctx.fillStyle = '#0f0f23'
      ctx.fillRect(0, 0, w, h)

      // Column background
      ctx.fillStyle = '#1a1a2e'
      ctx.beginPath()
      ctx.roundRect(colX, colY, colW, colH, 4)
      ctx.fill()

      const layers = [
        { name: 'Suelo vegetal', color: '#5D4037', depth: 0.3 },
        { name: 'Arcilla', color: '#8D6E63', depth: 0.8 },
        { name: 'Marga', color: '#BCAAA4', depth: 1.5 },
        { name: '★ CALIZA', color: '#BDBDBD', depth: 2.5, highlight: true },
        { name: 'Dolomita', color: '#9E9E9E', depth: 3.5 },
        { name: 'Basamento', color: '#616161', depth: 5.0 },
      ]
      const maxDepth = 5

      // Mark local rock types
      for (const l of layers) {
        const cleanName = l.name.replace('★ ', '').toLowerCase()
        if (localTypes.has(cleanName)) {
          l.highlight = true
        }
      }

      // Draw layers
      let prevDepth = 0
      for (const layer of layers) {
        const y1 = colY + colH * (prevDepth / maxDepth)
        const y2 = colY + colH * (layer.depth / maxDepth)
        const lh = y2 - y1

        // Layer fill
        const grad = ctx.createLinearGradient(colX, y1, colX, y2)
        grad.addColorStop(0, layer.highlight ? lighten(layer.color, 20) : layer.color)
        grad.addColorStop(1, layer.color)
        ctx.fillStyle = grad
        ctx.fillRect(colX, y1, colW, lh)

        // Pattern overlay for texture
        if (layer.name.includes('CALIZA')) {
          ctx.save()
          ctx.globalAlpha = 0.08
          for (let i = 0; i < colW * 3; i += 8) {
            const px = colX + (i % colW)
            const py = y1 + (i % lh)
            ctx.fillStyle = '#000'
            ctx.beginPath()
            ctx.arc(px, py, 1, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }

        // Layer border
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(colX, y1, colW, lh)

        // Right label
        ctx.fillStyle = layer.highlight ? '#ffff00' : '#ccc'
        ctx.font = layer.highlight ? 'bold 10px sans-serif' : '10px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const labelY = y1 + lh / 2
        ctx.fillText(layer.name, colX + colW + 6, labelY)
        if (layer.depth) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          ctx.font = '8px sans-serif'
          ctx.fillText(`${layer.depth}m`, colX + colW + 6, labelY + 12)
        }

        prevDepth = layer.depth
      }

      // Depth axis
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 0.5
      for (let d = 0; d <= maxDepth; d++) {
        const y = colY + colH * (d / maxDepth)
        ctx.beginPath()
        ctx.moveTo(colX - 6, y)
        ctx.lineTo(colX, y)
        ctx.stroke()

        // Horizontal guide
        ctx.globalAlpha = 0.06
        ctx.beginPath()
        ctx.moveTo(colX, y)
        ctx.lineTo(colX + colW, y)
        ctx.stroke()
        ctx.globalAlpha = 1

        // Depth label
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${d}m`, colX - 9, y)
      }

      // Surface line
      ctx.strokeStyle = '#4caf50'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(colX, colY)
      ctx.lineTo(colX + colW, colY)
      ctx.stroke()

      // Title
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('Perfil estratigráfico', w / 2, 2)

      // Caliza status
      const calizaColor = calizaCheck.hasCaliza ? '#2ecc71' : '#e74c3c'
      const calizaText = calizaCheck.hasCaliza ? 'HAY CALIZA' : 'NO SE DETECTA CALIZA'
      ctx.fillStyle = calizaColor
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${calizaCheck.hasCaliza ? '\u2705' : '\u274c'} ${calizaText}`, w / 2, h - 3)

      if (calizaCheck.source) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '8px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${calizaCheck.source} (a ${calizaCheck.nearest} km)`, w / 2, h - 15)
      }
    }

    draw()
    drawRef.current = draw
    const ro = new ResizeObserver(draw)
    ro.observe(container)

    return () => {
      ro.disconnect()
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }
  }, [isWeb]) // eslint-disable-line

  useEffect(() => {
    drawRef.current?.()
  }, [calizaCheck, localTypes]) // eslint-disable-line

  return React.createElement(View, { style: { padding: 10, alignItems: 'center' } },
    React.createElement(View, {
      ref: containerRef,
      style: { width: '100%', maxWidth: 400, aspectRatio: 2 / 3, alignSelf: 'center', borderRadius: 8, overflow: 'hidden' }
    }),
    React.createElement(Text, { style: { color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', marginTop: 4 } },
      'Columna estratigráfica del subsuelo basada en muestras locales'
    )
  )
}

export function ARScreen({ navigation }: any) {
  const currentLocation = useCurrentLocation()
  const { samples } = useAppStore()
  const [targets, setTargets] = useState<ARTarget[]>([])
  const [selectedTarget, setSelectedTarget] = useState<ARTarget | null>(null)
  const [showList, setShowList] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [heading, setHeading] = useState(0)
  const [arMode, setArMode] = useState<'basic' | 'scan' | 'struct' | 'model'>('basic')

  useEffect(() => {
    if (!currentLocation) return

    const loadTargets = async () => {
      const zones = await getAllZones()

      const allTargets: ARTarget[] = [
        ...samples.filter(Boolean).map(s => ({
          id: s.id,
          name: s.estimatedRockType || 'Muestra',
          latitude: s.latitude,
          longitude: s.longitude,
          distance: calculateDistance(currentLocation.latitude, currentLocation.longitude, s.latitude, s.longitude),
          bearing: calculateBearing(currentLocation.latitude, currentLocation.longitude, s.latitude, s.longitude),
          type: 'sample' as const,
          color: s.status === 'validado' ? COLORS.success : s.status === 'descartado' ? COLORS.danger : COLORS.warning,
        })),
        ...zones.map(z => ({
          id: z.id,
          name: `Zona ${z.probability}`,
          latitude: z.coordinates[0]?.latitude || currentLocation.latitude,
          longitude: z.coordinates[0]?.longitude || currentLocation.longitude,
          distance: calculateDistance(currentLocation.latitude, currentLocation.longitude, z.coordinates[0]?.latitude || currentLocation.latitude, z.coordinates[0]?.longitude || currentLocation.longitude),
          bearing: calculateBearing(currentLocation.latitude, currentLocation.longitude, z.coordinates[0]?.latitude || currentLocation.latitude, z.coordinates[0]?.longitude || currentLocation.longitude),
          type: 'zone' as const,
          color: getZoneColor(z.probability),
        })),
      ]

      allTargets.sort((a, b) => a.distance - b.distance)
      setTargets(allTargets.slice(0, 20))
    }

    loadTargets()
  }, [currentLocation, samples])



  useEffect(() => {
    if (!isWeb) {
      let magnetometerSub: any = null
      try {
        const M = require('expo-sensors').Magnetometer
        magnetometerSub = M.addListener((data: { x: number; y: number; z: number }) => {
          const h = Math.atan2(data.y, data.x) * (180 / Math.PI)
          if (!isNaN(h)) setHeading(smoothHeading((h + 360) % 360))
        })
        M.setUpdateInterval(100)
      } catch {}
      let watchId: number | null = null
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (pos.coords.heading != null && pos.coords.heading >= 0) setHeading(smoothHeading(pos.coords.heading))
          },
          () => {},
          { enableHighAccuracy: true },
        )
      }
      return () => {
        if (watchId != null) navigator.geolocation.clearWatch(watchId)
        if (magnetometerSub) magnetometerSub.remove()
      }
    }

    // --- Web heading tracking ---
    let watchId: number | null = null
    let sensor: any = null
    let gpsFallback: number | null = null

    // Priority 1: AbsoluteOrientationSensor (Android Chrome)
    async function initSensor() {
      try {
        const nav = navigator as any
        if (!nav.permissions || !nav.permissions.query) return
        const accel = await nav.permissions.query({ name: 'accelerometer' as any }).catch(() => null)
        const magnet = await nav.permissions.query({ name: 'magnetometer' as any }).catch(() => null)
        if (accel?.state === 'denied' || magnet?.state === 'denied') return
        const Sensor = (window as any).AbsoluteOrientationSensor
        if (!Sensor) return
        sensor = new Sensor({ frequency: 30, referenceFrame: 'device' })
        sensor.addEventListener('reading', () => {
          if (!sensor?.quaternion) return
          const q = sensor.quaternion
          const siny = 2 * (q[3] * q[2] + q[0] * q[1])
          const cosy = 1 - 2 * (q[1] * q[1] + q[2] * q[2])
          const h = Math.atan2(siny, cosy) * 180 / Math.PI
          setHeading(smoothHeading((h + 360) % 360, 0.3))
        })
        sensor.addEventListener('error', () => {})
        sensor.start()
      } catch {}
    }
    initSensor()

    // Priority 2: DeviceOrientationEvent
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // iOS: webkitCompassHeading gives true heading
      // Android: use alpha (rotation around Z-axis)
      if ((e as any).webkitCompassHeading != null) {
        setHeading(smoothHeading((e as any).webkitCompassHeading))
        return
      }
      if (e.alpha != null && (e as any).absolute === true) {
        const h = (360 - e.alpha) % 360
        setHeading(smoothHeading(h))
      }
    }
    const requestOrientation = () => {
      const api = (window as any).DeviceOrientationEvent
      if (api?.requestPermission) {
        api.requestPermission().then((state: string) => {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation)
          }
        })
      } else {
        window.addEventListener('deviceorientation', handleOrientation)
      }
    }
    requestOrientation()

    // Priority 3: GPS heading (only updates when moving)
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.heading != null && pos.coords.heading >= 0) {
            gpsFallback = pos.coords.heading
            setHeading(smoothHeading(pos.coords.heading))
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0 },
      )
    }

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      if (sensor) sensor.stop()
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [])

  const filteredTargets = searchQuery.trim()
    ? targets.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatDistance(t.distance).includes(searchQuery)
      )
    : targets

  const clickEl = (onPress: () => void, style: any, children: any) => {
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style
    return isWeb
      ? React.createElement('div', { onClick: onPress, style: flatStyle }, children)
      : React.createElement(TouchableOpacity, { onPress, style }, children)
  }

  const dirLabel = (bearing: number) => {
    const diff = ((bearing - heading) % 360 + 360) % 360
    if (diff < 30 || diff > 330) return 'Adelante'
    if (diff < 150) return 'Derecha'
    if (diff < 210) return 'Atrás'
    return 'Izquierda'
  }

  const formatDistance = (km: number) => {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`
    return `${km.toFixed(2)} km`
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              {clickEl(() => navigation?.navigate('Inicio'),
                styles.backBtn,
                React.createElement(Text, { style: styles.backBtnText }, '← Menú')
              )}
              <Text style={styles.title}>Realidad Aumentada</Text>
              <View style={{ width: 60 }} />
           </View>
           <Text style={styles.subtitle}>
             {targets.length} puntos de interés cercanos
           </Text>
         </View>

         <View style={styles.modeSelector}>
           {['basic', 'scan', 'struct', 'model'].map(mode => (
             <TouchableOpacity key={mode} onPress={() => { console.log('Mode pressed:', mode); setArMode(mode as any); }} style={[styles.modeBtn, arMode === mode && styles.modeBtnActive]}>
                <Text style={styles.modeBtnText}>{mode === 'basic' ? '📍' : mode === 'scan' ? '🔍' : mode === 'struct' ? '🗺️' : '🏗️'}</Text>
             </TouchableOpacity>
           ))}
         </View>

          {arMode === 'basic' ? (
            <View style={styles.targetsContainer}>
            {targets.length > 0 && targets.slice(0, 5).map(target => (
              clickEl(() => {
                console.log('Tocaste zona inline:', target.name, 'Bearing:', target.bearing);
                setSelectedTarget(target);
              },
                [styles.targetCard, { borderLeftColor: target.color }],
                [React.createElement(View, { style: styles.targetInfo, key: 'info' },
                  React.createElement(Text, { style: styles.targetName }, target.name),
                  React.createElement(Text, { style: styles.targetDist },
                    `${dirLabel(target.bearing)} · ${formatDistance(target.distance)}`
                  )
                ),
                React.createElement(View, { style: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }, key: 'arrow' },
                  isWeb
                    ? React.createElement('span', { style: { display: 'inline-block', fontSize: 18, transform: `rotate(${target.bearing - heading}deg)`, color: target.color } }, '▲')
                    : React.createElement(Text, { style: { fontSize: 18, color: target.color, transform: [{ rotate: `${target.bearing - heading}deg` }] } }, '▲')
                )]
              )
            ))}
            </View>
          ) : arMode === 'scan' ? (
            <ScanModeView samples={samples} location={currentLocation} />
          ) : arMode === 'struct' ? (
            <Model3DView heading={heading} isWeb={isWeb} location={currentLocation} samples={samples} />
          ) : (
            <ModelModeView heading={heading} isWeb={isWeb} location={currentLocation} samples={samples} />
          )}

         {targets.length > 5 && arMode === 'basic' && clickEl(() => setShowList(true), styles.showAllBtn,
           React.createElement(Text, { style: styles.showAllText }, `Ver todos (${targets.length})`)
         )}


          {selectedTarget && (() => {
            const diff = ((selectedTarget.bearing - heading) % 360 + 360) % 360
            const dirText = diff < 20 || diff > 340 ? 'Adelante'
              : diff < 90 ? 'Derecha'
              : diff < 160 ? 'Derecha'
              : diff < 200 ? 'Atrás'
              : diff < 270 ? 'Izquierda'
              : 'Izquierda'
            const dirArrow = diff < 20 || diff > 340 ? '↑'
              : diff < 90 ? '↗'
              : diff < 160 ? '→'
              : diff < 200 ? '↓'
              : diff < 270 ? '↙'
              : '←'

            return (
            <View style={[styles.targetDetail, {borderWidth: 2, borderColor: '#00FF00'}]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailTitle}>{selectedTarget.name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                    {formatDistance(selectedTarget.distance)}
                  </Text>
                </View>
                {isWeb
                  ? React.createElement('div', {
                      onClick: () => setSelectedTarget(null),
                      onTouchEnd: (e: any) => { e.preventDefault(); setSelectedTarget(null) },
                      style: { ...styles.closeX, cursor: 'pointer' },
                    }, React.createElement('span', { style: { color: '#fff', fontSize: 20, fontWeight: '800' } }, '✕'))
                  : React.createElement(TouchableOpacity, { onPress: () => setSelectedTarget(null), style: styles.closeX },
                      React.createElement(Text, { style: styles.closeXText }, '✕')
                    )
                }
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, gap: 12 }}>
                <Text style={{ fontSize: 40, color: selectedTarget.color }}>{dirArrow}</Text>
                <View>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>{dirText}</Text>
                  <Text style={{ fontSize: 12, color: selectedTarget.color }}>
                    Gira el celular para actualizar la dirección
                  </Text>
                </View>
              </View>

              <Text style={styles.detailText}>Tipo: {selectedTarget.type === 'sample' ? 'Muestra' : 'Zona'}</Text>
              {isWeb
                ? React.createElement('div', {
                    onClick: () => setSelectedTarget(null),
                    onTouchEnd: (e: any) => { e.preventDefault(); setSelectedTarget(null) },
                    style: { ...styles.closeDetail, cursor: 'pointer' },
                  }, React.createElement('span', { style: { color: COLORS.accent, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 } }, 'Cerrar panel'))
                : React.createElement(TouchableOpacity, { onPress: () => setSelectedTarget(null), style: styles.closeDetail },
                    React.createElement(Text, { style: styles.closeDetailText }, 'Cerrar panel')
                  )
              }
            </View>
            )
          })()}
        </View>
      </CameraView>

      <Modal visible={showList} transparent animationType="slide" onShow={() => setSearchQuery('')}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Puntos de interés</Text>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nombre, tipo o distancia..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.searchClear} onPress={() => setSearchQuery('')}>
                  <Text style={styles.searchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredTargets}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>
                    {searchQuery ? 'Sin resultados para esta búsqueda' : 'No hay puntos cercanos'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const zoneLabel = item.type === 'zone' ? 'Zona' : 'Muestra'
                const zoneColor = item.type === 'zone' ? item.color : COLORS.textMuted
                return clickEl(() => { 
                  console.log('Zona seleccionada:', item.name, 'Bearing:', item.bearing);
                  setSelectedTarget(item); 
                  setShowList(false); 
                },
                  [styles.listItem, { borderLeftColor: item.color }],
                  [
                    React.createElement(View, { style: styles.listItemLeft, key: 'left' },
                      React.createElement(View, { style: [styles.listBadge, { backgroundColor: zoneColor + '30' }] },
                        React.createElement(Text, { style: [styles.listBadgeText, { color: zoneColor }] }, zoneLabel)
                      ),
                      React.createElement(View, { style: styles.listItemInfo, key: 'info' },
                        React.createElement(Text, { style: styles.listName, key: 'name' }, item.name),
                        React.createElement(Text, { style: styles.listDist, key: 'dist' },
                          `${formatDistance(item.distance)} · ${dirLabel(item.bearing)}`
                        )
                      ),
                    ),
                    React.createElement(View, { style: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }, key: 'arrow' },
                      isWeb
                        ? React.createElement('span', { style: { display: 'inline-block', fontSize: 20, transform: `rotate(${item.bearing - heading}deg)`, color: item.color } }, '▲')
                        : React.createElement(Text, { style: { fontSize: 20, color: item.color, transform: [{ rotate: `${item.bearing - heading}deg` }] } }, '▲')
                    ),
                  ]
                )
              }}
            />

            <View style={styles.listFooter}>
              <Text style={styles.listFooterText}>
                {filteredTargets.length} de {targets.length} puntos
              </Text>
              {clickEl(() => { setShowList(false); setSearchQuery('') }, styles.closeBtn,
                React.createElement(Text, { style: styles.closeBtnText }, 'Cerrar')
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  modePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  placeholderText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  header: { padding: 16, paddingTop: 50 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4, textAlign: 'center' },
  targetsContainer: { padding: 16, gap: 8 },
  targetCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    alignItems: 'center',
  },
  targetInfo: { flex: 1 },
  targetName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  targetDist: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  targetDot: { width: 12, height: 12, borderRadius: 6 },
  showAllBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  showAllText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
  targetDetail: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    padding: 12,
  },
  detailTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  detailText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginVertical: 2 },
  closeX: { position: 'absolute', top: 8, right: 12, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  closeXText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  closeDetail: { marginTop: 8, alignSelf: 'stretch', alignItems: 'center', backgroundColor: COLORS.accent + '30', borderRadius: 12, paddingVertical: 10 },
  closeDetailText: { color: COLORS.accent, fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 28,
    maxHeight: '75%',
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center', letterSpacing: 0.5 },
  searchContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    borderRadius: 12,
    padding: 14,
    paddingRight: 44,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  searchClear: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  searchClearText: { color: COLORS.textMuted, fontSize: 16, fontWeight: '700' },
  emptyList: { paddingVertical: 40, alignItems: 'center' },
  emptyListText: { color: COLORS.textMuted, fontSize: 14 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderLeftWidth: 3,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: COLORS.surfaceLight,
  },
  listItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  listBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  listItemInfo: { flex: 1 },
  listName: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  listDist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  listFooterText: { color: COLORS.textMuted, fontSize: 13 },
  closeBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  closeBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  modeSelector: { flexDirection: 'row', justifyContent: 'center', gap: 10, padding: 10, zIndex: 100 },
  modeBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 20 },
  modeBtnActive: { backgroundColor: COLORS.accent },
  modeBtnText: { fontSize: 20 },
})
