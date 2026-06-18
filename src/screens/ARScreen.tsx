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

export function ARScreen() {
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
    if (!isWeb) return
    let watchId: number | null = null
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.heading != null) setHeading(pos.coords.heading)
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0 },
      )
    }
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha != null) setHeading(e.alpha)
    }
    const requestOrientation = () => {
      const api = (window as any).DeviceOrientationEvent
      if (api?.requestPermission) {
        api.requestPermission().then((state: string) => {
          if (state === 'granted') window.addEventListener('deviceorientation', handleOrientation)
        })
      } else {
        window.addEventListener('deviceorientation', handleOrientation)
      }
    }
    requestOrientation()
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [])

  const clickEl = (onPress: () => void, style: any, children: any) =>
    isWeb
      ? React.createElement('div', { onClick: onPress, style }, children)
      : React.createElement(TouchableOpacity, { onPress, style }, children)

  const formatDistance = (km: number) => {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`
    return `${km.toFixed(2)} km`
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back">
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.title}>Realidad Aumentada</Text>
            <Text style={styles.subtitle}>
              {targets.length} puntos de interés cercanos
            </Text>
          </View>

          <View style={styles.compass}>
            <Text style={styles.compassText}>{heading.toFixed(0)}°</Text>
            <View style={[styles.compassArrow]}>
              {isWeb
                ? React.createElement('span', {
                    style: { display: 'inline-block', transform: `rotate(${heading}deg)`, color: COLORS.highlight, fontSize: 20 }
                  }, '▲')
                : <Text style={styles.arrowUp}>▲</Text>
              }
            </View>
          </View>

          <View style={styles.targetsContainer}>
            {targets.slice(0, 5).map(target => (
              clickEl(() => setSelectedTarget(target),
                [styles.targetCard, { borderLeftColor: target.color }],
                [React.createElement(View, { style: styles.targetInfo, key: 'info' },
                  React.createElement(Text, { style: styles.targetName }, target.name),
                  React.createElement(Text, { style: styles.targetDist },
                    `${formatDistance(target.distance)} · ${target.bearing.toFixed(0)}°`
                  )
                ),
                React.createElement(View, { style: [styles.targetDot, { backgroundColor: target.color }], key: 'dot' })]
              )
            ))}
          </View>

          {targets.length > 5 && clickEl(() => setShowList(true), styles.showAllBtn,
            React.createElement(Text, { style: styles.showAllText }, `Ver todos (${targets.length})`)
          )}

          {selectedTarget && (
            <View style={styles.targetDetail}>
              <Text style={styles.detailTitle}>{selectedTarget.name}</Text>
              <Text style={styles.detailText}>
                Distancia: {formatDistance(selectedTarget.distance)}
              </Text>
              <Text style={styles.detailText}>
                Rumbo: {selectedTarget.bearing.toFixed(1)}°
              </Text>
              <Text style={styles.detailText}>
                Tipo: {selectedTarget.type === 'sample' ? 'Muestra' : 'Zona'}
              </Text>
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
  header: { padding: 20, paddingTop: 50 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  compass: {
    position: 'absolute',
    top: 50,
    right: 20,
    alignItems: 'center',
  },
  compassText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  compassArrow: { marginTop: -4 },
  arrowUp: { color: COLORS.highlight, fontSize: 20 },
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
