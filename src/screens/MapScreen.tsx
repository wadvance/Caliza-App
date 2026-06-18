import { useState, useEffect, useCallback, useRef } from 'react'
import { View, StyleSheet, TouchableOpacity, Text, Modal, FlatList, TextInput, Dimensions, Alert } from 'react-native'
import MapView, { Marker, Polygon, Polyline } from '../components/MapViewWrapper'
import { useAppStore } from '../store/useAppStore'
import { COLORS } from '../types/constants'
import { LayerToggle } from '../components/LayerToggle'
import { useCurrentLocation } from '../services/locationService'
import { getAllZones, getAllSamples, webSaveRoutes, webLoadRoutes } from '../services/database'
import { Sample, CalizaZone, AccessRoute } from '../types'

const { height } = Dimensions.get('window')

interface Township {
  id: string
  name: string
  lat: number
  lng: number
}

interface District {
  id: string
  name: string
  lat: number
  lng: number
  townships?: Township[]
}

interface Province {
  id: string
  name: string
  lat: number
  lng: number
  districts: District[]
}

const PANAMA: Province[] = [
  {
    id: 'bocas-del-toro', name: 'Bocas del Toro', lat: 9.3403, lng: -82.2420,
    districts: [
      { id: 'bocas-del-toro-d', name: 'Bocas del Toro', lat: 9.3333, lng: -82.2500 },
      { id: 'changuinola', name: 'Changuinola', lat: 9.4167, lng: -82.5167 },
      { id: 'chiriqui-grande', name: 'Chiriquí Grande', lat: 9.2833, lng: -82.1167 },
    ],
  },
  {
    id: 'cocle', name: 'Coclé', lat: 8.4580, lng: -80.4400,
    districts: [
      { id: 'aguadulce', name: 'Aguadulce', lat: 8.2417, lng: -80.5406 },
      { id: 'anton', name: 'Antón', lat: 8.4000, lng: -80.2667 },
      { id: 'la-pintada', name: 'La Pintada', lat: 8.5833, lng: -80.5500 },
      { id: 'nata', name: 'Natá', lat: 8.3333, lng: -80.5167 },
      { id: 'ola', name: 'Olá', lat: 8.4167, lng: -80.6500 },
      { id: 'penonome', name: 'Penonomé', lat: 8.5167, lng: -80.3500 },
    ],
  },
  {
    id: 'colon', name: 'Colón', lat: 9.3546, lng: -79.9000,
    districts: [
      { id: 'colon-d', name: 'Colón', lat: 9.3590, lng: -79.9014 },
      { id: 'chagres', name: 'Chagres', lat: 9.2167, lng: -80.0000 },
      { id: 'donoso', name: 'Donoso', lat: 9.1333, lng: -80.3333 },
      { id: 'portobelo', name: 'Portobelo', lat: 9.5500, lng: -79.6500 },
      { id: 'santa-isabel', name: 'Santa Isabel', lat: 9.5167, lng: -79.1667 },
      { id: 'omar-torrijos', name: 'Omar Torrijos H.', lat: 8.8833, lng: -80.6333 },
    ],
  },
  {
    id: 'chiriqui', name: 'Chiriquí', lat: 8.4333, lng: -82.3333,
    districts: [
      { id: 'alanje', name: 'Alanje', lat: 8.4000, lng: -82.5667,
        townships: [
          { id: 'alanje-c', name: 'Alanje', lat: 8.4000, lng: -82.5667 },
          { id: 'divala', name: 'Divalá', lat: 8.4167, lng: -82.6333 },
          { id: 'el-tejar', name: 'El Tejar', lat: 8.3833, lng: -82.5500 },
          { id: 'guarumal', name: 'Guarumal', lat: 8.3500, lng: -82.5333 },
          { id: 'palo-grande', name: 'Palo Grande', lat: 8.3667, lng: -82.6167 },
          { id: 'querevalo', name: 'Querévalo', lat: 8.3667, lng: -82.5000 },
          { id: 'santo-tomas', name: 'Santo Tomás', lat: 8.4333, lng: -82.5833 },
        ] },
      { id: 'baru', name: 'Barú', lat: 8.2833, lng: -82.8667,
        townships: [
          { id: 'puerto-armuelles', name: 'Puerto Armuelles', lat: 8.2833, lng: -82.8667 },
          { id: 'limones', name: 'Limones', lat: 8.2500, lng: -82.8667 },
          { id: 'progreso', name: 'Progreso', lat: 8.3167, lng: -82.9000 },
          { id: 'baco', name: 'Baco', lat: 8.3000, lng: -82.8833 },
          { id: 'rodolfo-aguilar', name: 'Rodolfo Aguilar Delgado', lat: 8.2500, lng: -82.8500 },
        ] },
      { id: 'boqueron', name: 'Boquerón', lat: 8.5000, lng: -82.5667,
        townships: [
          { id: 'boqueron-c', name: 'Boquerón', lat: 8.5000, lng: -82.5667 },
          { id: 'bagala', name: 'Bágala', lat: 8.4667, lng: -82.5833 },
          { id: 'cordillera', name: 'Cordillera', lat: 8.5333, lng: -82.6000 },
          { id: 'guabal', name: 'Guabal', lat: 8.5167, lng: -82.5333 },
          { id: 'guayabal', name: 'Guayabal', lat: 8.5500, lng: -82.5500 },
          { id: 'paraiso', name: 'Paraíso', lat: 8.5333, lng: -82.4833 },
          { id: 'pedregal-bq', name: 'Pedregal', lat: 8.4833, lng: -82.5500 },
          { id: 'tijeras', name: 'Tijeras', lat: 8.5167, lng: -82.4833 },
        ] },
      { id: 'boquete', name: 'Boquete', lat: 8.7833, lng: -82.4333,
        townships: [
          { id: 'bajo-boquete', name: 'Bajo Boquete', lat: 8.7833, lng: -82.4333 },
          { id: 'alto-boquete', name: 'Alto Boquete', lat: 8.7667, lng: -82.4167 },
          { id: 'caldera', name: 'Caldera', lat: 8.6500, lng: -82.3500 },
          { id: 'jaramillo', name: 'Jaramillo', lat: 8.8000, lng: -82.4500 },
          { id: 'los-naranjos', name: 'Los Naranjos', lat: 8.7833, lng: -82.4000 },
          { id: 'palmira', name: 'Palmira', lat: 8.7333, lng: -82.4667 },
        ] },
      { id: 'bugaba', name: 'Bugaba', lat: 8.4833, lng: -82.6167,
        townships: [
          { id: 'la-concepcion', name: 'La Concepción', lat: 8.4833, lng: -82.6167 },
          { id: 'aserrio-gariche', name: 'Aserrío de Gariché', lat: 8.4500, lng: -82.7000 },
          { id: 'bugaba-c', name: 'Bugaba', lat: 8.5167, lng: -82.6500 },
          { id: 'cerro-punta', name: 'Cerro Punta', lat: 8.8833, lng: -82.5833 },
          { id: 'gomez', name: 'Gómez', lat: 8.5500, lng: -82.7000 },
          { id: 'la-estrella', name: 'La Estrella', lat: 8.4333, lng: -82.6500 },
          { id: 'san-andres', name: 'San Andrés', lat: 8.4833, lng: -82.6833 },
          { id: 'santa-marta', name: 'Santa Marta', lat: 8.5167, lng: -82.7167 },
          { id: 'santa-rosa', name: 'Santa Rosa', lat: 8.5500, lng: -82.6833 },
          { id: 'santo-domingo', name: 'Santo Domingo', lat: 8.4500, lng: -82.6833 },
          { id: 'sortova', name: 'Sortová', lat: 8.4667, lng: -82.6617 },
          { id: 'volcan', name: 'Volcán', lat: 8.7667, lng: -82.6333 },
        ] },
      { id: 'david', name: 'David', lat: 8.4333, lng: -82.4333,
        townships: [
          { id: 'david-c', name: 'David', lat: 8.4333, lng: -82.4333 },
          { id: 'bijagual', name: 'Bijagual', lat: 8.4333, lng: -82.4833 },
          { id: 'cochea', name: 'Cochea', lat: 8.4833, lng: -82.3833 },
          { id: 'chiriqui-d', name: 'Chiriquí', lat: 8.4667, lng: -82.4667 },
          { id: 'guaca', name: 'Guacá', lat: 8.4667, lng: -82.4000 },
          { id: 'las-lomas', name: 'Las Lomas', lat: 8.4333, lng: -82.3833 },
          { id: 'los-algarrobos', name: 'Los Algarrobos', lat: 8.4833, lng: -82.4333 },
          { id: 'pedregal-da', name: 'Pedregal', lat: 8.3833, lng: -82.4333 },
          { id: 'san-carlos-da', name: 'San Carlos', lat: 8.3833, lng: -82.4000 },
          { id: 'san-pablo-nuevo', name: 'San Pablo Nuevo', lat: 8.4500, lng: -82.4833 },
          { id: 'san-pablo-viejo', name: 'San Pablo Viejo', lat: 8.4500, lng: -82.4500 },
        ] },
      { id: 'dolega', name: 'Dolega', lat: 8.6333, lng: -82.4167,
        townships: [
          { id: 'dolega-c', name: 'Dolega', lat: 8.6333, lng: -82.4167 },
          { id: 'dos-rios', name: 'Dos Ríos', lat: 8.6333, lng: -82.3667 },
          { id: 'los-anastacios', name: 'Los Anastacios', lat: 8.6333, lng: -82.4500 },
          { id: 'potrerillos', name: 'Potrerillos', lat: 8.6833, lng: -82.4833 },
          { id: 'potrerillos-abajo', name: 'Potrerillos Abajo', lat: 8.6667, lng: -82.4667 },
          { id: 'rovira', name: 'Rovira', lat: 8.6000, lng: -82.4167 },
          { id: 'tinajas', name: 'Tinajas', lat: 8.6000, lng: -82.4500 },
        ] },
      { id: 'gualaca', name: 'Gualaca', lat: 8.5333, lng: -82.3000,
        townships: [
          { id: 'gualaca-c', name: 'Gualaca', lat: 8.5333, lng: -82.3000 },
          { id: 'hornito', name: 'Hornito', lat: 8.6500, lng: -82.2500 },
          { id: 'los-angeles', name: 'Los Ángeles', lat: 8.5833, lng: -82.2667 },
          { id: 'paja-de-sombrero', name: 'Paja de Sombrero', lat: 8.5333, lng: -82.3500 },
          { id: 'rincon', name: 'Rincón', lat: 8.4833, lng: -82.3000 },
        ] },
      { id: 'remedios', name: 'Remedios', lat: 8.2333, lng: -81.8333,
        townships: [
          { id: 'remedios-c', name: 'Remedios', lat: 8.2333, lng: -81.8333 },
          { id: 'el-nancito', name: 'El Nancito', lat: 8.2000, lng: -81.8333 },
          { id: 'el-porvenir', name: 'El Porvenir', lat: 8.2500, lng: -81.8333 },
          { id: 'el-puerto', name: 'El Puerto', lat: 8.2500, lng: -81.8000 },
          { id: 'santa-lucia', name: 'Santa Lucía', lat: 8.2000, lng: -81.8500 },
        ] },
      { id: 'san-felix', name: 'San Félix', lat: 8.3000, lng: -81.8667,
        townships: [
          { id: 'san-felix-c', name: 'San Félix', lat: 8.3000, lng: -81.8667 },
          { id: 'las-lajas', name: 'Las Lajas', lat: 8.2500, lng: -81.8833 },
          { id: 'lajas-adentro', name: 'Lajas Adentro', lat: 8.2667, lng: -81.8333 },
          { id: 'san-juan-sf', name: 'San Juan', lat: 8.3333, lng: -81.8833 },
          { id: 'santa-cruz', name: 'Santa Cruz', lat: 8.3000, lng: -81.8500 },
        ] },
      { id: 'san-lorenzo', name: 'San Lorenzo', lat: 8.4000, lng: -82.1333,
        townships: [
          { id: 'san-lorenzo-c', name: 'San Lorenzo', lat: 8.4000, lng: -82.1333 },
          { id: 'boca-chica', name: 'Boca Chica', lat: 8.2167, lng: -82.2167 },
          { id: 'boca-del-monte', name: 'Boca del Monte', lat: 8.3500, lng: -82.1500 },
          { id: 'horconcitos', name: 'Horconcitos', lat: 8.3167, lng: -82.1833 },
          { id: 'san-juan-sl', name: 'San Juan', lat: 8.4167, lng: -82.1167 },
        ] },
      { id: 'tierras-altas', name: 'Tierras Altas', lat: 8.9167, lng: -82.6000,
        townships: [
          { id: 'volcan-ta', name: 'Volcán', lat: 8.7667, lng: -82.6333 },
          { id: 'cerro-punta-ta', name: 'Cerro Punta', lat: 8.8833, lng: -82.5833 },
          { id: 'cuesta-piedra', name: 'Cuesta de Piedra', lat: 8.9000, lng: -82.6167 },
          { id: 'nueva-california', name: 'Nueva California', lat: 8.8833, lng: -82.6500 },
          { id: 'paso-ancho', name: 'Paso Ancho', lat: 8.9333, lng: -82.5833 },
        ] },
      { id: 'tole', name: 'Tolé', lat: 8.2500, lng: -81.6667,
        townships: [
          { id: 'tole-c', name: 'Tolé', lat: 8.2500, lng: -81.6667 },
          { id: 'alto-tole', name: 'Alto Tolé', lat: 8.2000, lng: -81.6667 },
          { id: 'bella-vista-t', name: 'Bella Vista', lat: 8.2667, lng: -81.7000 },
          { id: 'cerro-viejo', name: 'Cerro Viejo', lat: 8.2833, lng: -81.6333 },
          { id: 'el-cristo', name: 'El Cristo', lat: 8.2500, lng: -81.7000 },
          { id: 'justo-fidel-palacios', name: 'Justo Fidel Palacios', lat: 8.2333, lng: -81.6500 },
          { id: 'lajas-de-tole', name: 'Lajas de Tolé', lat: 8.2167, lng: -81.6667 },
          { id: 'potrero-de-cana', name: 'Potrero de Caña', lat: 8.3000, lng: -81.6833 },
          { id: 'quebrada-piedra', name: 'Quebrada de Piedra', lat: 8.2833, lng: -81.6833 },
          { id: 'veladero', name: 'Veladero', lat: 8.2333, lng: -81.6833 },
        ] },
    ],
  },
  {
    id: 'darien', name: 'Darién', lat: 8.1000, lng: -77.5333,
    districts: [
      { id: 'chepigana', name: 'Chepigana', lat: 8.4833, lng: -78.1000 },
      { id: 'pinogana', name: 'Pinogana', lat: 8.1167, lng: -77.6833 },
      { id: 'santa-fe-darien', name: 'Santa Fe', lat: 8.5000, lng: -78.1333 },
    ],
  },
  {
    id: 'herrera', name: 'Herrera', lat: 7.8333, lng: -80.6667,
    districts: [
      { id: 'chitre', name: 'Chitré', lat: 7.9667, lng: -80.4333 },
      { id: 'las-minas', name: 'Las Minas', lat: 7.8000, lng: -80.7500 },
      { id: 'los-pozos', name: 'Los Pozos', lat: 7.7833, lng: -80.6333 },
      { id: 'ocu', name: 'Ocú', lat: 7.9500, lng: -80.7833 },
      { id: 'parita', name: 'Parita', lat: 7.9833, lng: -80.5167 },
      { id: 'pese', name: 'Pesé', lat: 7.9000, lng: -80.6167 },
      { id: 'santa-maria', name: 'Santa María', lat: 8.1167, lng: -80.6667 },
    ],
  },
  {
    id: 'los-santos', name: 'Los Santos', lat: 7.6000, lng: -80.3667,
    districts: [
      { id: 'guarare', name: 'Guararé', lat: 7.8167, lng: -80.2833 },
      { id: 'las-tablas', name: 'Las Tablas', lat: 7.7667, lng: -80.2833 },
      { id: 'los-santos-d', name: 'Los Santos', lat: 7.9333, lng: -80.4167 },
      { id: 'macaracas', name: 'Macaracas', lat: 7.7333, lng: -80.5500 },
      { id: 'pedasi', name: 'Pedasí', lat: 7.5300, lng: -80.0167 },
      { id: 'pocri', name: 'Pocrí', lat: 7.6500, lng: -80.1167 },
      { id: 'tonosi', name: 'Tonosí', lat: 7.4167, lng: -80.4333 },
    ],
  },
  {
    id: 'panama', name: 'Panamá', lat: 9.0000, lng: -79.5000,
    districts: [
      { id: 'balboa', name: 'Balboa', lat: 8.9500, lng: -79.5667 },
      { id: 'chepo', name: 'Chepo', lat: 9.1667, lng: -79.1000 },
      { id: 'chiman', name: 'Chimán', lat: 8.7167, lng: -78.6333 },
      { id: 'panama-d', name: 'Panamá', lat: 9.0000, lng: -79.5000 },
      { id: 'san-miguelito', name: 'San Miguelito', lat: 9.0333, lng: -79.5000 },
      { id: 'taboga', name: 'Taboga', lat: 8.8000, lng: -79.5500 },
    ],
  },
  {
    id: 'panama-oeste', name: 'Panamá Oeste', lat: 8.8833, lng: -79.7833,
    districts: [
      { id: 'arraijan', name: 'Arraiján', lat: 8.9500, lng: -79.6500 },
      { id: 'capira', name: 'Capira', lat: 8.7500, lng: -79.8833 },
      { id: 'chame', name: 'Chame', lat: 8.5833, lng: -79.8833 },
      { id: 'la-chorrera', name: 'La Chorrera', lat: 8.8833, lng: -79.7833 },
      { id: 'san-carlos', name: 'San Carlos', lat: 8.4833, lng: -79.9500 },
    ],
  },
  {
    id: 'veraguas', name: 'Veraguas', lat: 8.1000, lng: -81.0000,
    districts: [
      { id: 'atalaya', name: 'Atalaya', lat: 8.0500, lng: -80.9333 },
      { id: 'calobre', name: 'Calobre', lat: 8.3167, lng: -80.8333 },
      { id: 'canazas', name: 'Cañazas', lat: 8.3167, lng: -81.2167 },
      { id: 'la-mesa', name: 'La Mesa', lat: 8.1500, lng: -81.1833 },
      { id: 'las-palmas', name: 'Las Palmas', lat: 8.1333, lng: -81.4500 },
      { id: 'mariato', name: 'Mariato', lat: 7.6000, lng: -80.8833 },
      { id: 'montijo', name: 'Montijo', lat: 7.9833, lng: -81.0667 },
      { id: 'rio-de-jesus', name: 'Río de Jesús', lat: 8.0833, lng: -81.1667 },
      { id: 'san-francisco', name: 'San Francisco', lat: 8.0500, lng: -81.3667 },
      { id: 'santa-fe-veraguas', name: 'Santa Fe', lat: 8.5000, lng: -81.0833 },
      { id: 'santiago', name: 'Santiago', lat: 8.1083, lng: -80.9722 },
      { id: 'sona', name: 'Soná', lat: 8.0167, lng: -81.3167 },
    ],
  },
  {
    id: 'guna-yala', name: 'Guna Yala', lat: 9.0667, lng: -78.0000,
    districts: [
      { id: 'guna-yala-d', name: 'Guna Yala', lat: 9.0667, lng: -78.0000 },
    ],
  },
  {
    id: 'embera', name: 'Emberá', lat: 8.5000, lng: -77.7000,
    districts: [
      { id: 'cemaco', name: 'Cémaco', lat: 8.1000, lng: -77.5333 },
      { id: 'sambu', name: 'Sambú', lat: 8.0167, lng: -78.2000 },
    ],
  },
  {
    id: 'ngabe-bugle', name: 'Ngäbe-Buglé', lat: 8.5000, lng: -81.5000,
    districts: [
      { id: 'besiko', name: 'Besikó', lat: 8.6000, lng: -81.8000 },
      { id: 'jirondai', name: 'Jirondai', lat: 8.9000, lng: -81.8000 },
      { id: 'kankintu', name: 'Kankintú', lat: 8.8333, lng: -81.7667 },
      { id: 'kusapin', name: 'Kusapín', lat: 9.2000, lng: -81.9000 },
      { id: 'mirono', name: 'Mironó', lat: 8.5000, lng: -81.6000 },
      { id: 'muna', name: 'Müna', lat: 8.4333, lng: -81.6333 },
      { id: 'nole-duima', name: 'Nole Duima', lat: 8.4500, lng: -81.9000 },
      { id: 'nurum', name: 'Ñürüm', lat: 8.4500, lng: -81.7833 },
      { id: 'calovebora', name: 'Santa Catalina/Calovébora', lat: 8.8333, lng: -81.0667 },
    ],
  },
]

export function MapScreen({ navigation }: any) {
  const currentLocation = useCurrentLocation()
  const { layers, toggleLayer, setSamples, setZones } = useAppStore()
  const [showLayers, setShowLayers] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null)
  const [targetRegion, setTargetRegion] = useState<any>(null)
  const [districtTownships, setDistrictTownships] = useState<(Township & { districtName: string; provinceName: string })[] | null>(null)
  const [samples, setLocalSamples] = useState<Sample[]>([])
  const [zones, setLocalZones] = useState<CalizaZone[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [loadedSamples, loadedZones] = await Promise.all([getAllSamples(), getAllZones()])
    setLocalSamples(loadedSamples)
    setLocalZones(loadedZones)
    setZones(loadedZones)
  }

  const getZoneColor = (probability: string) => {
    switch (probability) {
      case 'alta': return COLORS.probabilityHigh
      case 'media': return COLORS.probabilityMedium
      case 'baja': return COLORS.probabilityLow
      default: return COLORS.probabilityPending
    }
  }

  const { routes, setRoutes, addRoute, removeRoute } = useAppStore()
  const [showRouteNameModal, setShowRouteNameModal] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingPoints, setRecordingPoints] = useState<{ latitude: number; longitude: number }[]>([])
  const [routeName, setRouteName] = useState('')
  const watchIdRef = useRef<any>(null)
  const routeColors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']

  useEffect(() => {
    const saved = webLoadRoutes()
    if (saved.length > 0) setRoutes(saved)
  }, [])

  useEffect(() => {
    webSaveRoutes(routes)
  }, [routes])

  const startRecording = () => {
    setRecordingPoints([{
      latitude: currentLocation?.latitude || 8.9824,
      longitude: currentLocation?.longitude || -79.5199,
    }])
    setRecording(true)
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setRecordingPoints(prev => [...prev, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }])
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }

  const stopRecording = () => {
    if (watchIdRef.current && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setRecording(false)
    if (recordingPoints.length > 1) {
      setRouteName(`Ruta ${routes.length + 1}`)
      setShowRouteNameModal(true)
    } else {
      setRecordingPoints([])
    }
  }

  const saveRoute = () => {
    let dist = 0
    for (let i = 1; i < recordingPoints.length; i++) {
      const p1 = recordingPoints[i - 1], p2 = recordingPoints[i]
      const R = 6371
      const dLat = (p2.latitude - p1.latitude) * Math.PI / 180
      const dLon = (p2.longitude - p1.longitude) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2
      dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }
    const route: AccessRoute = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: routeName.trim() || `Ruta ${routes.length + 1}`,
      points: recordingPoints,
      color: routeColors[routes.length % routeColors.length],
      timestamp: Date.now(),
      distanceKm: Math.round(dist * 100) / 100,
    }
    addRoute(route)
    setShowRouteNameModal(false)
    setRecordingPoints([])
    setRouteName('')
  }

  const discardRoute = () => {
    setShowRouteNameModal(false)
    setRecordingPoints([])
    setRouteName('')
  }

  const visibleLayers = layers.filter(l => l.visible)
  const showPotentialZones = visibleLayers.some(l => l.id === 'potential')
  const showSamplePoints = visibleLayers.some(l => l.id === 'samples')
  const showRoutes = visibleLayers.some(l => l.id === 'routes')

  const allTownships: (Township & { districtName: string; provinceName: string })[] =
    PANAMA.flatMap(p =>
      p.districts.flatMap(d =>
        (d.townships || []).map(t => ({ ...t, districtName: d.name, provinceName: p.name }))
      )
    )

  const filteredProvinces = searchText.trim()
    ? PANAMA.filter(p => p.name.toLowerCase().includes(searchText.trim().toLowerCase()))
    : PANAMA

  const filteredAllTownships = searchText.trim()
    ? allTownships.filter(t => t.name.toLowerCase().includes(searchText.trim().toLowerCase()))
    : []

  const filteredDistricts = searchText.trim() && selectedProvince
    ? selectedProvince.districts.filter(d => d.name.toLowerCase().includes(searchText.trim().toLowerCase()))
    : selectedProvince?.districts || []

  const handleSelectProvince = (province: Province) => {
    if (province.districts.length === 1) {
      const d = province.districts[0]
      if (d.townships && d.townships.length > 0) {
        setDistrictTownships(d.townships.map(t => ({ ...t, districtName: d.name, provinceName: province.name })))
        setSelectedProvince(null)
        setSearchText('')
      } else {
        setTargetRegion({ latitude: d.lat, longitude: d.lng, latitudeDelta: 0.25, longitudeDelta: 0.25 })
        setShowSearch(false)
        setSelectedProvince(null)
        setSearchText('')
      }
    } else {
      setSelectedProvince(province)
      setDistrictTownships(null)
      setSearchText('')
    }
  }

  const handleSelectDistrict = (district: District) => {
    const towns = allTownships.filter(t => t.districtName === district.name && t.provinceName === selectedProvince?.name)
    if (towns.length > 0) {
      setDistrictTownships(towns)
      setSearchText('')
    } else {
      setTargetRegion({ latitude: district.lat, longitude: district.lng, latitudeDelta: 0.1, longitudeDelta: 0.1 })
      setShowSearch(false)
      setSelectedProvince(null)
      setSearchText('')
    }
  }

  const handleSelectTownship = (township: Township) => {
    setTargetRegion({ latitude: township.lat, longitude: township.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 })
    setShowSearch(false)
    setSelectedProvince(null)
    setDistrictTownships(null)
    setSearchText('')
  }

  const handleBack = () => {
    if (districtTownships) {
      setDistrictTownships(null)
    } else {
      setSelectedProvince(null)
    }
    setSearchText('')
  }

  const handleCloseSearch = () => {
    setShowSearch(false)
    setSelectedProvince(null)
    setDistrictTownships(null)
    setSearchText('')
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>🗺️ GeoCaliza</Text>
        <View style={styles.topBarRight}>
          {zones.length > 0 && showPotentialZones && (
            <View style={styles.zoneLegend}>
              <Text style={styles.legendTitle}>Probabilidad</Text>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityHigh }]} />
                <Text style={styles.legendLabel}>Alta</Text>
                <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityMedium }]} />
                <Text style={styles.legendLabel}>Media</Text>
                <View style={[styles.legendDot, { backgroundColor: COLORS.probabilityLow }]} />
                <Text style={styles.legendLabel}>Baja</Text>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.searchBtn} onPress={() => setShowSearch(true)}>
            <Text style={styles.searchBtnText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.layerBtn} onPress={() => setShowLayers(true)}>
            <Text style={styles.layerBtnText}>⊞ Capas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView style={styles.map} initialRegion={targetRegion || {
        latitude: currentLocation?.latitude || 8.9824,
        longitude: currentLocation?.longitude || -79.5199,
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      }}>
        {showPotentialZones && zones.map(zone => (
          <Polygon key={zone.id} coordinates={zone.coordinates}
            fillColor={zone.probability === 'alta' ? COLORS.probabilityHigh + '40' :
                       zone.probability === 'media' ? COLORS.probabilityMedium + '35' :
                       COLORS.probabilityLow + '30'}
            strokeColor={getZoneColor(zone.probability)} strokeWidth={2}
          />
        ))}
        {showSamplePoints && samples.map(sample => (
          <Marker key={sample.id}
            coordinate={{ latitude: sample.latitude, longitude: sample.longitude }}
            pinColor={sample.status === 'validado' ? COLORS.success : sample.status === 'descartado' ? COLORS.danger : COLORS.warning}
          />
        ))}
        {showRoutes && routes.map(route => (
          <Polyline key={route.id}
            coordinates={route.points}
            strokeColor={route.color}
            strokeWidth={4}
          />
        ))}
        {recording && recordingPoints.length > 1 && (
          <Polyline key="recording"
            coordinates={recordingPoints}
            strokeColor="#e74c3c"
            strokeWidth={4}
          />
        )}
      </MapView>

      <View style={styles.overlay}>
        {currentLocation && (
          <View style={styles.coords}>
            <Text style={styles.coordsText}>
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}
        {!recording ? (
          <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
            <Text style={styles.recordBtnText}>⏺ Grabar ruta</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
            <Text style={styles.stopBtnText}>⏹ Detener ({recordingPoints.length} pts)</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Camara', { screen: 'CameraMain' })}>
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Escanear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Camara', { screen: 'RegisterSample' })}>
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>Registrar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Muestras', { screen: 'SampleListMain' })}>
          <Text style={styles.actionIcon}>📍</Text>
          <Text style={styles.actionLabel}>Muestras</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Más', { screen: 'Satellite' })}>
          <Text style={styles.actionIcon}>🛰️</Text>
          <Text style={styles.actionLabel}>Satélite</Text>
        </TouchableOpacity>
      </View>

      {/* Search modal */}
      <Modal visible={showSearch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: height * 0.75 }]}>
            <Text style={styles.modalTitle}>
              {districtTownships
                ? 'Corregimientos'
                : selectedProvince
                  ? `Distritos de ${selectedProvince.name}`
                  : 'Buscar provincia'}
            </Text>
            {(selectedProvince || districtTownships) && (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backBtnText}>← Volver{districtTownships ? ' a distritos' : ' a provincias'}</Text>
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.searchInput}
              placeholder={
                districtTownships ? 'Buscar corregimiento...' :
                selectedProvince ? 'Buscar distrito...' :
                'Ej: Chiriquí, David, Penonomé...'}
              placeholderTextColor={COLORS.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />

            {districtTownships ? (
              <FlatList
                data={
                  searchText.trim()
                    ? filteredAllTownships
                    : districtTownships
                }
                keyExtractor={item => item.id}
                style={styles.provinceList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.townshipRow} onPress={() => handleSelectTownship(item)}>
                    <Text style={styles.townshipName}>{item.name}</Text>
                    <Text style={styles.townshipSub}>{item.districtName}, {item.provinceName}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : selectedProvince ? (
              <FlatList
                data={filteredDistricts}
                keyExtractor={item => item.id}
                style={styles.provinceList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.provinceRow} onPress={() => handleSelectDistrict(item)}>
                    <Text style={styles.provinceName}>{item.name}</Text>
                    <Text style={styles.provinceCoords}>{item.lat.toFixed(2)}, {item.lng.toFixed(2)}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <FlatList
                data={
                  searchText.trim() && filteredAllTownships.length > 0
                    ? [...filteredProvinces, { __type: 'separator' as const }, ...filteredAllTownships]
                    : filteredProvinces}
                keyExtractor={(item: any, index: number) => item.__type === 'separator' ? 'sep' : item.id}
                style={styles.provinceList}
                renderItem={({ item }: any) => {
                  if (item.__type === 'separator') {
                    return (
                      <View style={styles.separatorRow}>
                        <Text style={styles.separatorText}>Corregimientos</Text>
                      </View>
                    )
                  }
                  if ('districts' in item) {
                    return (
                      <TouchableOpacity style={styles.provinceRow} onPress={() => handleSelectProvince(item)}>
                        <Text style={styles.provinceName}>{item.name}</Text>
                        <Text style={styles.provinceBadge}>{item.districts.length} distritos</Text>
                      </TouchableOpacity>
                    )
                  }
                  return (
                    <TouchableOpacity style={styles.townshipRow} onPress={() => handleSelectTownship(item)}>
                      <Text style={styles.townshipName}>{item.name}</Text>
                      <Text style={styles.townshipSub}>{item.districtName}, {item.provinceName}</Text>
                    </TouchableOpacity>
                  )
                }}
              />
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={handleCloseSearch}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showLayers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Capas del mapa</Text>
            <FlatList data={layers} keyExtractor={item => item.id}
              renderItem={({ item }) => <LayerToggle layer={item} onToggle={toggleLayer} />}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLayers(false)}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Route name modal */}
      <Modal visible={showRouteNameModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Guardar ruta</Text>
            <Text style={styles.routeDistText}>
              Distancia: {(() => {
                let d = 0
                for (let i = 1; i < recordingPoints.length; i++) {
                  const p1 = recordingPoints[i - 1], p2 = recordingPoints[i]
                  const R = 6371
                  const dLat = (p2.latitude - p1.latitude) * Math.PI / 180
                  const dLon = (p2.longitude - p1.longitude) * Math.PI / 180
                  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2
                  d += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                }
                return `${d < 1 ? (d * 1000).toFixed(0) + ' m' : d.toFixed(2) + ' km'}`
              })()}
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Nombre de la ruta"
              placeholderTextColor={COLORS.textMuted}
              value={routeName}
              onChangeText={setRouteName}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.closeBtn, { flex: 1, backgroundColor: COLORS.surfaceLight }]} onPress={discardRoute}>
                <Text style={[styles.closeBtnText, { color: COLORS.text }]}>Descartar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.closeBtn, { flex: 1 }]} onPress={saveRoute}>
                <Text style={styles.closeBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: COLORS.surface + 'E6',
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneLegend: {
    backgroundColor: COLORS.surfaceLight + 'E6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendTitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: COLORS.textSecondary, fontSize: 10 },
  brand: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  searchBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.highlight, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { fontSize: 16 },
  layerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceLight },
  layerBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  map: { flex: 1 },
  overlay: { position: 'absolute', top: 100, left: 16, right: 16, alignItems: 'center' },
  coords: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  coordsText: { color: '#fff', fontSize: 11, fontFamily: 'monospace' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, paddingBottom: 30,
    backgroundColor: COLORS.surface + 'E6',
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  actionBtn: { alignItems: 'center', paddingHorizontal: 16 },
  actionIcon: { fontSize: 24 },
  actionLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: COLORS.highlight, fontSize: 14, fontWeight: '600' },
  searchInput: { backgroundColor: COLORS.surfaceLight, borderRadius: 10, padding: 12, color: COLORS.text, fontSize: 15, marginBottom: 12 },
  provinceList: { maxHeight: height * 0.4 },
  provinceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  provinceName: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  provinceCoords: { color: COLORS.textMuted, fontSize: 12 },
  provinceBadge: { color: COLORS.accent, fontSize: 11, fontWeight: '600' },
  separatorRow: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surfaceLight + '80' },
  separatorText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' as any },
  townshipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  townshipName: { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  townshipSub: { color: COLORS.textMuted, fontSize: 11 },
  closeBtn: { backgroundColor: COLORS.accent, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  closeBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  recordBtn: {
    marginTop: 8, backgroundColor: '#e74c3c', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  recordBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stopBtn: {
    marginTop: 8, backgroundColor: '#c0392b', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  stopBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  routeDistText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 12 },
})
