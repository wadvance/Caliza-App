import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, FlatList, Platform } from 'react-native'
import { COLORS } from '../types/constants'
import { useCurrentLocation, calculateBearing, calculateDistance } from '../services/locationService'
import { getAllZones } from '../services/database'
import { Sample, CalizaZone } from '../types'
import { useAppStore } from '../store/useAppStore'

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
  const [prop1, setProp1] = useState<string | null>(null)
  const [prop2, setProp2] = useState<string | null>(null)
  const [prop3, setProp3] = useState<string | null>(null)

  const result = !prop1 ? null
    : prop1 === 'clara' && prop2 === 'suave' ? 'Caliza (CaCO₃)'
    : prop1 === 'clara' && prop2 === 'dura' ? 'Dolomita'
    : prop1 === 'media' && prop2 === 'suave' ? 'Marga'
    : prop1 === 'media' && prop2 === 'porosa' ? 'Travertino'
    : prop1 === 'oscura' && prop2 === 'dura' ? 'Basalto'
    : prop1 === 'oscura' && prop2 === 'suave' ? 'Arcilla'
    : prop1 === 'clara' && prop3 === 'si' ? 'Yeso'
    : prop1 === 'media' && prop3 === 'no' ? 'Caliche'
    : 'Tipo no determinado'

  const reset = () => { setProp1(null); setProp2(null); setProp3(null) }

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

  return React.createElement(View, { style: scanStyles.container },
    React.createElement(Text, { style: scanStyles.title }, '🔍 Identificación visual de roca'),
    React.createElement(Text, { style: scanStyles.sub }, 'Selecciona las propiedades de la muestra:'),
    !prop1 ? row('Color', [
      { value: 'clara', label: 'Clara (beige/blanco)' },
      { value: 'media', label: 'Media (marrón/gris)' },
      { value: 'oscura', label: 'Oscura (negra/gris oscuro)' },
    ], prop1, v => setProp1(v))
    : !prop2 ? row('Textura', [
      { value: 'suave', label: 'Suave/tiza' },
      { value: 'dura', label: 'Dura/compacta' },
      { value: 'porosa', label: 'Porosa/esponjosa' },
    ], prop2, v => setProp2(v))
    : !prop3 && (prop1 === 'clara') ? row('¿Reacciona con ácido?', [
      { value: 'si', label: 'Sí (efervescencia)' },
      { value: 'no', label: 'No' },
    ], prop3, v => setProp3(v))
    : null,
    result && React.createElement(View, { style: scanStyles.result },
      React.createElement(Text, { style: scanStyles.resultText }, 'Resultado: ' + result),
      !result.includes('determinado') && React.createElement(Text, { style: scanStyles.resultSub },
        result === 'Caliza (CaCO₃)' ? 'Alta efervescencia con HCl. Roca sedimentaria carbonatada. Uso: cemento, cal.'
        : result === 'Dolomita' ? 'Efervescencia leve. Contiene magnesio. Uso: refractarios, construcción.'
        : result === 'Marga' ? 'Mezcla de caliza y arcilla. Uso: materia prima para cemento.'
        : result === 'Travertino' ? 'Porosa y ligera. Formada por precipitación en manantiales. Uso: decoración.'
        : result === 'Basalto' ? 'Roca ígnea oscura y densa. Uso: agregados de construcción.'
        : result === 'Arcilla' ? 'Plástica cuando se humedece. Uso: ladrillos, cerámica.'
        : result === 'Yeso' ? 'Muy suave, raya con uña. Uso: yesería, cemento.'
        : 'Capa superficial dura. Uso: cal agrícola.'
      ),
      React.createElement(TouchableOpacity, { onPress: reset, style: scanStyles.resetBtn },
        React.createElement(Text, { style: scanStyles.resetText }, 'Reiniciar')
      )
    ),
    samples.length > 0 && React.createElement(View, { style: scanStyles.nearby },
      React.createElement(Text, { style: scanStyles.nearbyTitle }, 'Muestras cercanas registradas:'),
      ...samples.slice(0, 3).map(s =>
        React.createElement(Text, { style: scanStyles.nearbyItem, key: s.id },
          `• ${s.estimatedRockType || 'Tipo desconocido'} (${s.status})`
        )
      )
    )
  )
}

const scanStyles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' },
  row: { gap: 8 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opt: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  optSel: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  optText: { color: '#fff', fontSize: 13 },
  optTextSel: { color: '#fff', fontWeight: '700' },
  result: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 16, gap: 8, marginTop: 8 },
  resultText: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  resultSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  resetBtn: { backgroundColor: COLORS.highlight, padding: 10, borderRadius: 8, alignSelf: 'center', marginTop: 8 },
  resetText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  nearby: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 12, gap: 4 },
  nearbyTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  nearbyItem: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
})

function StructModeView({ heading, isWeb }: { heading: number; isWeb: boolean }) {
  const canvasRef = useRef<any>(null)
  const [dip, setDip] = useState(45)
  const [strike, setStrike] = useState(0)

  useEffect(() => {
    if (!isWeb || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const size = Math.min(canvas.clientWidth, canvas.clientHeight, 300)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = size + 'px'
    canvas.style.height = size + 'px'
    ctx.scale(dpr, dpr)

    const cx = size / 2, cy = size / 2, r = size / 2 - 10

    ctx.clearRect(0, 0, size, size)

    // Outer circle
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()

    // Cardinal directions
    ctx.fillStyle = '#fff'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('N', cx, cy - r - 5)
    ctx.fillText('S', cx, cy + r + 15)
    ctx.fillText('E', cx + r + 15, cy + 4)
    ctx.fillText('W', cx - r - 15, cy + 4)

    // Tick marks every 10 degrees
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < 360; i += 10) {
      const a = i * Math.PI / 180
      const inner = i % 30 === 0 ? r - 8 : r - 4
      ctx.beginPath()
      ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
      ctx.lineTo(cx + inner * Math.cos(a), cy + inner * Math.sin(a))
      ctx.stroke()
    }

    // Great circles (grid)
    for (let d = 10; d < 90; d += 10) {
      const rad = r * Math.tan((45 - d / 2) * Math.PI / 180)
      const dist = r / Math.cos((45 - d / 2) * Math.PI / 180)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.arc(cx, cy - dist, rad, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy + dist, rad, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Small circles (grid)
    for (let d = 10; d < 90; d += 10) {
      const rad = r * Math.tan((d / 2) * Math.PI / 180)
      const dist = r / Math.cos((d / 2) * Math.PI / 180)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.arc(cx - dist, cy, rad, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx + dist, cy, rad, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Fault plane (great circle for given strike and dip)
    const strikeRad = strike * Math.PI / 180
    const dipRad = dip * Math.PI / 180
    const poleDist = r * Math.tan((45 - dip / 2) * Math.PI / 180)
    const poleAngle = strikeRad + Math.PI / 2

    ctx.strokeStyle = '#00FF88'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(
      cx + poleDist * Math.sin(poleAngle),
      cy - poleDist * Math.cos(poleAngle),
      r / Math.cos((45 - dip / 2) * Math.PI / 180),
      -Math.PI / 2 + poleAngle - Math.acos(Math.cos((45 - dip / 2) * Math.PI / 180)),
      -Math.PI / 2 + poleAngle + Math.acos(Math.cos((45 - dip / 2) * Math.PI / 180))
    )
    ctx.stroke()

    // Dip direction arrow
    const dipDir = (strike + 90) % 360
    const dipArrow = dipDir * Math.PI / 180
    const arrowLen = r * 0.6
    ctx.strokeStyle = '#FF6600'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + arrowLen * Math.sin(dipArrow), cy - arrowLen * Math.cos(dipArrow))
    ctx.stroke()

    // Info text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Falla: Rumbo ${strike}° · Buzamiento ${dip}°`, cx, size - 4)
    ctx.fillStyle = '#FF6600'
    ctx.font = '11px sans-serif'
    ctx.fillText(`Dirección de buzamiento: ${dipDir}°`, cx, 14)
  }, [dip, strike, isWeb])

  const canvas = isWeb
    ? React.createElement('canvas', {
        ref: canvasRef,
        style: { width: '90%', maxWidth: 300, aspectRatio: '1', alignSelf: 'center' }
      })
    : React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
        React.createElement(Text, { style: { color: '#fff', fontSize: 14 } }, 'Proyección estructural no disponible')
      )

  return React.createElement(View, { style: { flex: 1, padding: 10, gap: 8 } },
    React.createElement(Text, { style: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' } }, '📐 Proyección estereográfica'),
    canvas,
    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'center', gap: 10 } },
      React.createElement(TouchableOpacity, { onPress: () => setStrike((strike + 10) % 360), style: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 8 } },
        React.createElement(Text, { style: { color: '#fff' } }, 'Rumbo +10°')
      ),
      React.createElement(TouchableOpacity, { onPress: () => setDip(Math.min(dip + 5, 90)), style: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 8 } },
        React.createElement(Text, { style: { color: '#fff' } }, 'Buz. +5°')
      ),
      React.createElement(TouchableOpacity, { onPress: () => setDip(Math.max(dip - 5, 5)), style: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 8 } },
        React.createElement(Text, { style: { color: '#fff' } }, 'Buz. -5°')
      ),
    ),
    React.createElement(View, { style: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 10, marginTop: 4 } },
      React.createElement(Text, { style: { color: '#00FF88', fontSize: 13 } }, '• Línea verde: plano de falla'),
      React.createElement(Text, { style: { color: '#FF6600', fontSize: 13 } }, '• Línea naranja: dirección de buzamiento'),
    )
  )
}

function ModelModeView({ heading, isWeb }: { heading: number; isWeb: boolean }) {
  const canvasRef = useRef<any>(null)
  const layers = [
    { name: 'Suelo vegetal', color: '#5D4037', depth: 0.3 },
    { name: 'Arcilla', color: '#8D6E63', depth: 0.8 },
    { name: 'Marga', color: '#BCAAA4', depth: 1.5 },
    { name: 'Caliza', color: '#BDBDBD', depth: 2.5 },
    { name: 'Dolomita', color: '#9E9E9E', depth: 3.5 },
    { name: 'Basamento', color: '#616161', depth: 5.0 },
  ]

  useEffect(() => {
    if (!isWeb || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 320
    const h = canvas.clientHeight || 240
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    const maxDepth = 5
    const margin = 50
    const drawW = w - margin * 2
    const drawH = h - margin * 2

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, margin)
    skyGrad.addColorStop(0, '#0a0a2a')
    skyGrad.addColorStop(1, '#1a1a4a')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, w, margin)

    // Ground surface line
    ctx.strokeStyle = '#4CAF50'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin, margin)
    for (let x = 0; x <= drawW; x += 5) {
      const y = margin + Math.sin(x * 0.05) * 5
      ctx.lineTo(margin + x, y)
    }
    ctx.stroke()

    // Draw layers
    let prevDepth = 0
    layers.forEach(layer => {
      const yStart = margin + (prevDepth / maxDepth) * drawH
      const yEnd = margin + (layer.depth / maxDepth) * drawH
      ctx.fillStyle = layer.color
      ctx.fillRect(margin, yStart, drawW, yEnd - yStart)
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(margin, yStart, drawW, yEnd - yStart)
      ctx.fillStyle = '#fff'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${layer.name} (${layer.depth}m)`, margin + 8, yStart + (yEnd - yStart) / 2 + 4)
      prevDepth = layer.depth
    })

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    for (let d = 0; d <= maxDepth; d += 1) {
      const y = margin + (d / maxDepth) * drawH
      ctx.fillText(`-${d}m`, margin - 5, y + 4)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(margin, y)
      ctx.lineTo(margin + drawW, y)
      ctx.stroke()
    }

    // Title
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Corte geológico transversal - Yacimiento de Caliza', w / 2, 18)
  }, [isWeb])

  const canvas = isWeb
    ? React.createElement('canvas', {
        ref: canvasRef,
        style: { width: '95%', aspectRatio: '4/3', alignSelf: 'center', borderRadius: 8, maxWidth: 400 }
      })
    : React.createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center' } },
        React.createElement(Text, { style: { color: '#fff', fontSize: 14 } }, 'Modelo 3D no disponible')
      )

  return React.createElement(View, { style: { flex: 1, padding: 10, gap: 6 } },
    canvas,
    React.createElement(View, { style: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 10, marginTop: 4 } },
      React.createElement(Text, { style: { color: '#fff', fontSize: 12, textAlign: 'center' } },
        'Corte vertical del subsuelo mostrando las capas geológicas. ' +
        'La caliza se encuentra aproximadamente a 1.5-2.5 m de profundidad en esta proyección.'
      )
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
               <Text style={styles.modeBtnText}>{mode === 'basic' ? '📍' : mode === 'scan' ? '🔍' : mode === 'struct' ? '📐' : '🏗️'}</Text>
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
            <StructModeView heading={heading} isWeb={isWeb} />
          ) : (
            <ModelModeView heading={heading} isWeb={isWeb} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailTitle}>{selectedTarget.name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
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

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 16 }}>
                <Text style={{ fontSize: 48, color: selectedTarget.color }}>{dirArrow}</Text>
                <View>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>{dirText}</Text>
                  <Text style={{ fontSize: 14, color: selectedTarget.color }}>
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
    padding: 20,
  },
  detailTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  detailText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginVertical: 2 },
  closeX: { position: 'absolute', top: 8, right: 12, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  closeXText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  closeDetail: { marginTop: 12, alignSelf: 'stretch', alignItems: 'center', backgroundColor: COLORS.accent + '30', borderRadius: 12, paddingVertical: 12 },
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
