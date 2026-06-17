import { useMemo, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native'
import { COLORS } from '../types/constants'

const isWeb = Platform.OS === 'web'

let NativeMapView: any = null
let NativeMarker: any = null
let NativePolygon: any = null
let NativePolyline: any = null
let NativeCallout: any = null
let WebViewModule: any = null
if (!isWeb) {
  try {
    const Maps = require('react-native-maps')
    NativeMapView = Maps.default
    NativeMarker = Maps.Marker
    NativePolygon = Maps.Polygon
    NativePolyline = Maps.Polyline
    NativeCallout = Maps.Callout
  } catch {}
  try {
    WebViewModule = require('react-native-webview').default
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

const MarkerComponent = (props: MarkerProps) => {
  if (isWeb || !NativeMarker) {
    return null
  }
  return <NativeMarker {...props} />
}
MarkerComponent.displayName = 'Marker'

const PolygonComponent = (props: PolygonProps) => {
  if (isWeb || !NativePolygon) {
    return null
  }
  return <NativePolygon {...props} />
}
PolygonComponent.displayName = 'Polygon'

const PolylineComponent = (props: PolylineProps) => {
  if (isWeb || !NativePolyline) {
    return null
  }
  return <NativePolyline {...props} />
}

const CalloutComponent = (props: CalloutProps) => {
  if (isWeb || !NativeCallout) {
    return <>{props.children}</>
  }
  return <NativeCallout {...props} />
}

function buildLeafletHtml(props: MapViewProps, markers: MarkerProps[], polygons: PolygonProps[]): string {
  const reg = props.initialRegion || props.region || { latitude: 8.9824, longitude: -79.5199, latitudeDelta: 0.05, longitudeDelta: 0.05 }
  const center = [reg.latitude, reg.longitude]
  const zoom = Math.round(Math.log2(360 / Math.max(reg.latitudeDelta || 0.05, reg.longitudeDelta || 0.05)) + 1)

  const markerScript = markers.map((m, i) => {
    const color = m.pinColor || '#e94560'
    const iconSize = 24
    return `
      L.circleMarker([${m.coordinate.latitude}, ${m.coordinate.longitude}], {
        radius: 8, color: '${color}', fillColor: '${color}', fillOpacity: 0.9, weight: 2
      })
      ${m.title ? `.bindTooltip('${m.title.replace(/'/g, "\\'")}', {permanent: false})` : ''}
      .addTo(map);
    `
  }).join('\n')

  const polygonScript = polygons.map(p => {
    const coords = p.coordinates.map(c => `[${c.latitude}, ${c.longitude}]`).join(', ')
    const fill = p.fillColor || '#2ecc7140'
    const stroke = p.strokeColor || '#2ecc71'
    return `
      L.polygon([${coords}], {
        color: '${stroke}', fillColor: '${fill}', fillOpacity: 0.35, weight: ${p.strokeWidth || 2}
      }).addTo(map);
    `
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="referrer" content="origin"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; }
  html, body, #map { width: 100%; height: 100%; }
  body { background: #0f0f23; }
  .leaflet-control-zoom a { background: #fff !important; color: #333 !important; border-color: #ccc !important; }
  .leaflet-control-attribution { background: #fffffff2 !important; color: #666 !important; font-size: 10px !important; }
  .leaflet-control-attribution a { color: #666 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    center: [${center[0]}, ${center[1]}],
    zoom: ${zoom},
    zoomControl: true,
    attributionControl: true,
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
  }).addTo(map);

  ${markerScript}
  ${polygonScript}
</script>
</body>
</html>`
}

function WebMap({ style, children, ...props }: MapViewProps & { children?: React.ReactNode }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const markers: MarkerProps[] = []
  const polygons: PolygonProps[] = []

  const childrenArr = Array.isArray(children) ? children : [children]
  childrenArr.forEach((child: any) => {
    if (!child) return
    if (child.props?.coordinate && (child.type?.displayName === 'Marker' || child.type?.name === 'Marker')) {
      markers.push(child.props as MarkerProps)
    }
    if (child.props?.coordinates && (child.type?.displayName === 'Polygon' || child.type?.name === 'Polygon')) {
      polygons.push(child.props as PolygonProps)
    }
  })

  const html = useMemo(() => buildLeafletHtml(props, markers, polygons),
    [props.initialRegion?.latitude, props.initialRegion?.longitude,
     markers.length, polygons.length, JSON.stringify(markers), JSON.stringify(polygons)])

  const blobUrl = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [html])

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl)
  }, [blobUrl])

  return (
    <View style={style} pointerEvents="auto">
      <iframe
        ref={iframeRef}
        src={blobUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="map"
      />
    </View>
  )
}

function MobileWebMap({ style, children, ...props }: MapViewProps & { children?: React.ReactNode }) {
  const markers: MarkerProps[] = []
  const polygons: PolygonProps[] = []

  const childrenArr = Array.isArray(children) ? children : [children]
  childrenArr.forEach((child: any) => {
    if (!child) return
    if (child.props?.coordinate && (child.type?.displayName === 'Marker' || child.type?.name === 'Marker')) {
      markers.push(child.props as MarkerProps)
    }
    if (child.props?.coordinates && (child.type?.displayName === 'Polygon' || child.type?.name === 'Polygon')) {
      polygons.push(child.props as PolygonProps)
    }
  })

  const html = useMemo(() => buildLeafletHtml(props, markers, polygons),
    [props.initialRegion?.latitude, props.initialRegion?.longitude,
     markers.length, polygons.length, JSON.stringify(markers), JSON.stringify(polygons)])

  if (!WebViewModule) {
    return (
      <View style={[style, styles.fallback]}>
        <Text style={styles.fallbackText}>Mapa no disponible</Text>
      </View>
    )
  }

  return (
    <View style={style}>
      <WebViewModule
        source={{ html }}
        style={{ flex: 1 }}
        scrollEnabled={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  )
}

const MapViewComponent = (props: MapViewProps & { children?: React.ReactNode }, ref: any) => {
  if (isWeb) {
    return <WebMap {...props} />
  }

  if (!NativeMapView) {
    return <MobileWebMap {...props} />
  }

  return (
    <NativeMapView
      ref={ref}
      {...props}
    />
  )
}

const MapView = (props: MapViewProps & { children?: React.ReactNode }) => MapViewComponent(props, null)

let PROVIDER_GOOGLE: any = undefined
if (!isWeb) {
  try {
    const Maps = require('react-native-maps')
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE
  } catch {}
}

export const Marker = MarkerComponent
export const Polygon = PolygonComponent
export const Polyline = PolylineComponent
export const Callout = CalloutComponent
export { PROVIDER_GOOGLE }
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
})
