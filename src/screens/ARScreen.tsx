import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Platform } from 'react-native'
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

export function ARScreen({ navigation }: any) {
  const currentLocation = useCurrentLocation()
  const { samples } = useAppStore()
  const [targets, setTargets] = useState<ARTarget[]>([])
  const [selectedTarget, setSelectedTarget] = useState<ARTarget | null>(null)
  const [showList, setShowList] = useState(false)
  const [heading, setHeading] = useState(0)

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
          color: z.probability === 'alta' ? COLORS.probabilityHigh : z.probability === 'media' ? COLORS.probabilityMedium : COLORS.probabilityLow,
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

          <View style={styles.compass}>
            <View style={styles.compassCircle}>
              {isWeb
                ? React.createElement('div', {
                    style: { width: '100%', height: '100%', position: 'relative' }
                  }, [
                    React.createElement('span', { key:'n', style:{position:'absolute',top:3,left:'50%',marginLeft:-4,color:'#fff',fontSize:9,fontWeight:'700'} }, 'N'),
                    React.createElement('span', { key:'s', style:{position:'absolute',bottom:3,left:'50%',marginLeft:-3,color:'#fff',fontSize:8} }, 'S'),
                    React.createElement('span', { key:'e', style:{position:'absolute',right:3,top:'50%',marginTop:-5,color:'#fff',fontSize:8} }, 'E'),
                    React.createElement('span', { key:'w', style:{position:'absolute',left:3,top:'50%',marginTop:-5,color:'#fff',fontSize:8} }, 'W'),
                    ...(!selectedTarget
                      ? [React.createElement('div', {
                          key:'ndl',
                          style:{position:'absolute',width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:10,transform:`rotate(${heading}deg)`}
                        }, [
                          React.createElement('div', { key:'nh', style:{width:3,height:18,backgroundColor:'#ff3333',borderRadius:'1px 1px 0 0'} }),
                          React.createElement('div', { key:'sh', style:{width:3,height:18,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:'0 0 1px 1px'} }),
                        ])]
                      : [React.createElement('div', {
                          key:'tgt',
                          style:{
                            position:'absolute',top:'50%',left:'50%',
                            width:0,height:0,
                            borderLeft:'4px solid transparent',
                            borderRight:'4px solid transparent',
                            borderTop:`8px solid ${selectedTarget.color}`,
                            transform:`translate(-50%,-50%) rotate(${selectedTarget.bearing}deg) translateY(-20px)`,
                          }
                        })]
                    ),
                    React.createElement('div', { key:'ct', style:{position:'absolute',top:'50%',left:'50%',width:5,height:5,marginTop:-2.5,marginLeft:-2.5,borderRadius:'50%',backgroundColor:'#fff'} }),
                  ])
                : (
                  <View style={{ width:'100%',height:'100%' }}>
                    <Text style={{position:'absolute',top:3,left:'50%',marginLeft:-4,color:'#fff',fontSize:9,fontWeight:'700'}}>N</Text>
                    <Text style={{position:'absolute',bottom:3,left:'50%',marginLeft:-3,color:'#fff',fontSize:8}}>S</Text>
                    <Text style={{position:'absolute',right:3,top:'50%',marginTop:-5,color:'#fff',fontSize:8}}>E</Text>
                    <Text style={{position:'absolute',left:3,top:'50%',marginTop:-5,color:'#fff',fontSize:8}}>W</Text>
                    {!selectedTarget ? (
                      <View style={{position:'absolute',width:'100%',height:'100%',alignItems:'center',paddingTop:10,transform:[{rotate:`${heading}deg`}]}}>
                        <View style={{width:3,height:18,backgroundColor:'#ff3333'}} />
                        <View style={{width:3,height:18,backgroundColor:'rgba(255,255,255,0.2)'}} />
                      </View>
                    ) : (
                      <View style={{position:'absolute',top:'50%',left:'50%',width:0,height:0,
                        borderLeftWidth:4,borderLeftColor:'transparent',
                        borderRightWidth:4,borderRightColor:'transparent',
                        borderTopWidth:8,borderTopColor:selectedTarget.color,
                        transform:[{translateX:-4},{translateY:-24},{rotate:`${selectedTarget.bearing}deg`}]
                      }} />
                    )}
                    <View style={{position:'absolute',top:'50%',left:'50%',width:5,height:5,marginTop:-2.5,marginLeft:-2.5,borderRadius:2.5,backgroundColor:'#fff'}} />
                  </View>
                )
              }
            </View>
            <Text style={styles.compassText}>
              {selectedTarget
                ? `${selectedTarget.bearing.toFixed(0)}° →`
                : `${heading.toFixed(0)}°`}
            </Text>
          </View>

          <View style={styles.targetsContainer}>
            {targets.length > 0 && targets.slice(0, 5).map(target => (
              clickEl(() => setSelectedTarget(target),
                [styles.targetCard, { borderLeftColor: target.color }],
                [React.createElement(View, { style: styles.targetInfo, key: 'info' },
                  React.createElement(Text, { style: styles.targetName }, target.name),
                  React.createElement(Text, { style: styles.targetDist },
                    `${dirLabel(target.bearing)} · ${formatDistance(target.distance)}`
                  )
                ),
                React.createElement(View, { style: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }, key: 'arrow' },
                  isWeb
                    ? React.createElement('span', { style: { display: 'inline-block', fontSize: 18, transform: `rotate(${target.bearing}deg)`, color: target.color } }, '▲')
                    : React.createElement(Text, { style: { fontSize: 18, color: target.color, transform: [{ rotate: `${target.bearing}deg` }] } }, '▲')
                )]
              )
            ))}
          </View>

          {targets.length > 5 && clickEl(() => setShowList(true), styles.showAllBtn,
            React.createElement(Text, { style: styles.showAllText }, `Ver todos (${targets.length})`)
          )}

          {selectedTarget && (
            <View style={styles.targetDetail}>
              {clickEl(() => setSelectedTarget(null), styles.closeX,
                React.createElement(Text, { style: styles.closeXText }, '✕')
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                  {isWeb
                    ? React.createElement('div', { style: { width: '100%', height: '100%', position: 'relative' } }, [
                        React.createElement('span', { key:'n', style: { position:'absolute', top: 1, left:'50%', marginLeft: -4, color:'#fff', fontSize: 8, fontWeight:'700' } }, 'N'),
                        React.createElement('span', { key:'s', style: { position:'absolute', bottom: 1, left:'50%', marginLeft: -3, color:'rgba(255,255,255,0.5)', fontSize: 7 } }, 'S'),
                        React.createElement('span', { key:'e', style: { position:'absolute', right: 1, top:'50%', marginTop: -4, color:'rgba(255,255,255,0.5)', fontSize: 7 } }, 'E'),
                        React.createElement('span', { key:'w', style: { position:'absolute', left: 1, top:'50%', marginTop: -4, color:'rgba(255,255,255,0.5)', fontSize: 7 } }, 'W'),
                        React.createElement('div', { key:'arrow', style: {
                          position:'absolute', top:'50%', left:'50%',
                          width:0, height:0,
                          borderLeft:'3px solid transparent',
                          borderRight:'3px solid transparent',
                          borderTop:`6px solid ${selectedTarget.color}`,
                          transform: `translate(-50%,-50%) rotate(${(selectedTarget.bearing - heading + 360) % 360}deg) translateY(-14px)`,
                        }}),
                      ])
                    : (
                      <View style={{ width:'100%',height:'100%' }}>
                        <Text style={{position:'absolute',top:1,left:'50%',marginLeft:-4,color:'#fff',fontSize:8,fontWeight:'700'}}>N</Text>
                        <Text style={{position:'absolute',bottom:1,left:'50%',marginLeft:-3,color:'rgba(255,255,255,0.5)',fontSize:7}}>S</Text>
                        <Text style={{position:'absolute',right:1,top:'50%',marginTop:-4,color:'rgba(255,255,255,0.5)',fontSize:7}}>E</Text>
                        <Text style={{position:'absolute',left:1,top:'50%',marginTop:-4,color:'rgba(255,255,255,0.5)',fontSize:7}}>W</Text>
                        <View style={{position:'absolute',top:'50%',left:'50%',width:0,height:0,
                          borderLeftWidth:3,borderLeftColor:'transparent',
                          borderRightWidth:3,borderRightColor:'transparent',
                          borderTopWidth:6,borderTopColor:selectedTarget.color,
                          transform:[{translateX:-3},{translateY:-17},{rotate:`${(selectedTarget.bearing - heading + 360) % 360}deg`}]
                        }} />
                      </View>
                    )
                  }
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.detailTitle}>{selectedTarget.name}</Text>
                  <Text style={styles.detailText}>
                    {formatDistance(selectedTarget.distance)}
                  </Text>
                  <Text style={styles.detailText}>
                    {selectedTarget.bearing.toFixed(0)}° · {dirLabel(selectedTarget.bearing)}
                  </Text>
                </View>
              </View>
              <Text style={styles.detailText}>Tipo: {selectedTarget.type === 'sample' ? 'Muestra' : 'Zona'}</Text>
              {clickEl(() => setSelectedTarget(null), styles.closeDetail,
                React.createElement(Text, { style: styles.closeDetailText }, 'Cerrar')
              )}
            </View>
          )}
        </View>
      </CameraView>

      <Modal visible={showList} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Todos los puntos</Text>
            <FlatList
              data={targets}
              keyExtractor={item => item.id}
              renderItem={({ item }) => clickEl(() => { setSelectedTarget(item); setShowList(false) },
                [styles.listItem, { borderLeftColor: item.color }],
                [React.createElement(Text, { style: styles.listName, key: 'name' }, item.name),
                 React.createElement(Text, { style: styles.listDist, key: 'dist' },
                   `${formatDistance(item.distance)} · ${item.bearing.toFixed(0)}°`)]
              )}
            />
            {clickEl(() => setShowList(false), styles.closeBtn,
              React.createElement(Text, { style: styles.closeBtnText }, 'Cerrar')
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
  compass: {
    position: 'absolute',
    top: 50,
    right: 20,
    alignItems: 'center',
  },
  compassCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  compassText: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 2 },
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
  closeX: { position: 'absolute', top: 8, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeXText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeDetail: { marginTop: 12, alignSelf: 'center' },
  closeDetailText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderLeftWidth: 3,
    borderRadius: 8,
    marginVertical: 3,
    backgroundColor: COLORS.surfaceLight,
  },
  listName: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  listDist: { color: COLORS.textSecondary, fontSize: 13 },
  closeBtn: {
    backgroundColor: COLORS.accent,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  closeBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
})
