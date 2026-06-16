import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { COLORS } from '../types/constants'
import { LoginScreen } from '../screens/LoginScreen'
import { MapScreen } from '../screens/MapScreen'
import { CameraScreen } from '../screens/CameraScreen'
import { RegisterSampleScreen } from '../screens/RegisterSampleScreen'
import { SampleListScreen } from '../screens/SampleListScreen'
import { SampleDetailScreen } from '../screens/SampleDetailScreen'
import { SatelliteAnalysisScreen } from '../screens/SatelliteAnalysisScreen'
import { ARScreen } from '../screens/ARScreen'
import { ReportsScreen } from '../screens/ReportsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'

const RootStack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const MapStack = createNativeStackNavigator()
const CameraStack = createNativeStackNavigator()
const SamplesStack = createNativeStackNavigator()
const MoreStack = createNativeStackNavigator()

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.highlight,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.highlight,
  },
}

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.surface },
  headerTintColor: COLORS.text,
  headerTitleStyle: { fontWeight: '700' },
}

function MapStackScreen() {
  return (
    <MapStack.Navigator screenOptions={screenOptions}>
      <MapStack.Screen name="MapMain" component={MapScreen} options={{ title: 'Mapa geológico' }} />
      <MapStack.Screen name="SampleDetail" component={SampleDetailScreen} options={{ title: 'Detalle de muestra' }} />
    </MapStack.Navigator>
  )
}

function CameraStackScreen() {
  return (
    <CameraStack.Navigator screenOptions={screenOptions}>
      <CameraStack.Screen name="CameraMain" component={CameraScreen} options={{ title: 'Escanear roca' }} />
      <CameraStack.Screen name="RegisterSample" component={RegisterSampleScreen} options={{ title: 'Registrar muestra' }} />
    </CameraStack.Navigator>
  )
}

function SamplesStackScreen() {
  return (
    <SamplesStack.Navigator screenOptions={screenOptions}>
      <SamplesStack.Screen name="SampleListMain" component={SampleListScreen} options={{ title: 'Muestras' }} />
      <SamplesStack.Screen name="SampleDetail" component={SampleDetailScreen} options={{ title: 'Detalle de muestra' }} />
    </SamplesStack.Navigator>
  )
}

function MoreStackScreen() {
  return (
    <MoreStack.Navigator screenOptions={screenOptions}>
      <MoreStack.Screen name="Satellite" component={SatelliteAnalysisScreen} options={{ title: 'Análisis satelital' }} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reportes' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
    </MoreStack.Navigator>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.highlight,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tab.Screen name="Mapa" component={MapStackScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Camara" component={CameraStackScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Muestras" component={SamplesStackScreen} options={{ headerShown: false }} />
      <Tab.Screen name="AR" component={ARScreen} options={{ title: 'Realidad aumentada' }} />
      <Tab.Screen name="Más" component={MoreStackScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="MainTabs" component={MainTabs} />
      </RootStack.Navigator>
    </NavigationContainer>
  )
}
