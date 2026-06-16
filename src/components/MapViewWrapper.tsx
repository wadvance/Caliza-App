import { View, Text, Image, StyleSheet, Platform } from 'react-native'
import { COLORS } from '../types/constants'

const isWeb = Platform.OS === 'web'

let NativeMapView: any = null
let NativeMarker: any = null
let NativePolygon: any = null
let NativePolyline: any = null
let NativeCallout: any = null
let NativeMapViewDir: any = null

if (!isWeb) {
  try {
    const Maps = require('react-native-maps')
    NativeMapView = Maps.default
    NativeMarker = Maps.Marker
    NativePolygon = Maps.Polygon
    NativePolyline = Maps.Polyline
    NativeCallout = Maps.Callout
  } catch {}
}

type Region = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

type Coordinate = {
  latitude: number
  longitude: number
}

interface MapViewProps {
  ref?: any
  style?: any
  initialRegion?: Region
  region?: Region
  showsUserLocation?: boolean
  showsCompass?: boolean
  showsScale?: boolean
  rotateEnabled?: boolean
  toolbarEnabled?: boolean
  customMapStyle?: any[]
  provider?: any
  onRegionChangeComplete?: (region: Region) => void
  children?: React.ReactNode
}

interface MarkerProps {
  coordinate: Coordinate
  title?: string
  description?: string
  pinColor?: string
  children?: React.ReactNode
}

interface PolygonProps {
  coordinates: Coordinate[]
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  tappable?: boolean
  onPress?: () => void
}

interface PolylineProps {
  coordinates: Coordinate[]
  strokeColor?: string
  strokeWidth?: number
}

interface CalloutProps {
  children: React.ReactNode
  onPress?: () => void
}

export const Marker = (props: MarkerProps) => {
  if (isWeb || !NativeMarker) {
    return <View style={{ position: 'absolute', left: '50%', top: '50%' }} />
  }
  return <NativeMarker {...props} />
}

export const Polygon = (props: PolygonProps) => {
  if (isWeb || !NativePolygon) {
    return null
  }
  return <NativePolygon {...props} />
}

export const Polyline = (props: PolylineProps) => {
  if (isWeb || !NativePolyline) {
    return null
  }
  return <NativePolyline {...props} />
}

export const Callout = (props: CalloutProps) => {
  if (isWeb || !NativeCallout) {
    return <>{props.children}</>
  }
  return <NativeCallout {...props} />
}

const WebMapFallback = ({ initialRegion, style, children }: MapViewProps) => {
  const lat = initialRegion?.latitude || 19.4326
  const lon = initialRegion?.longitude || -99.1332

  return (
    <View style={[style, { backgroundColor: COLORS.surfaceLight }]}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
        <Text style={styles.mapPlaceholderCoords}>
          {lat.toFixed(4)}, {lon.toFixed(4)}
        </Text>
        <Text style={styles.mapPlaceholderHint}>
          Mapa disponible en dispositivo móvil
        </Text>
      </View>
      <View style={styles.webChildren} pointerEvents="box-none">{children}</View>
    </View>
  )
}

const MapViewComponent = (props: MapViewProps, ref: any) => {
  if (isWeb) {
    return <WebMapFallback {...props} />
  }

  if (!NativeMapView) {
    return (
      <View style={[props.style, styles.fallback]}>
        <Text style={styles.fallbackText}>Mapa no disponible</Text>
        <Text style={styles.fallbackSubtext}>Cargando módulo de mapas...</Text>
      </View>
    )
  }

  return (
    <NativeMapView
      ref={ref}
      {...props}
    />
  )
}

const MapView = (props: MapViewProps) => MapViewComponent(props, null)

let PROVIDER_GOOGLE: any = undefined
if (!isWeb) {
  try {
    const Maps = require('react-native-maps')
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE
  } catch {}
}

export { Marker, Polygon, Polyline, Callout, PROVIDER_GOOGLE }
export default MapView

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  fallbackText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  fallbackSubtext: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  webChildren: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapPlaceholderCoords: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  mapPlaceholderHint: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
})
