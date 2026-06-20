import { Text, View, TouchableOpacity } from 'react-native'
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { COLORS } from '../types/constants'
import { LoginScreen } from '../screens/LoginScreen'
import { DashboardScreen } from '../screens/DashboardScreen'
import { MapScreen } from '../screens/MapScreen'
import { CameraScreen } from '../screens/CameraScreen'
import { RegisterSampleScreen } from '../screens/RegisterSampleScreen'
import { SampleListScreen } from '../screens/SampleListScreen'
import { SampleDetailScreen } from '../screens/SampleDetailScreen'
import { SatelliteAnalysisScreen } from '../screens/SatelliteAnalysisScreen'
import { ARScreen } from '../screens/ARScreen'
import { ReportsScreen } from '../screens/ReportsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { WorkflowGuideScreen } from '../screens/WorkflowGuideScreen'

const RootStack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const HomeStack = createNativeStackNavigator()
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

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="DashboardMain" component={DashboardScreen} />
    </HomeStack.Navigator>
  )
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
    <MoreStack.Navigator screenOptions={screenOptions} initialRouteName="Settings">
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Configuración' }} />
      <MoreStack.Screen name="RegisterSample" component={RegisterSampleScreen} options={{ title: 'Registrar muestra' }} />
      <MoreStack.Screen name="Satellite" component={SatelliteAnalysisScreen} options={{ title: 'Análisis satelital' }} />
      <MoreStack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reportes' }} />
      <MoreStack.Screen name="WorkflowGuide" component={WorkflowGuideScreen} options={{ title: 'Guía de campo' }} />
    </MoreStack.Navigator>
  )
}

const VISIBLE_TABS = [
  { name: 'Inicio', icon: '🏠', label: 'Inicio' },
  { name: 'Muestras', icon: '📋', label: 'Muestras' },
  { name: 'AR', icon: '🪄', label: 'Realidad' },
  { name: 'Más', icon: '⚙️', label: 'Más' },
]

function MyTabBar({ state, descriptors, navigation }: any) {
  const visibleNames = VISIBLE_TABS.map(t => t.name)
  const visibleRoutes = state.routes.filter((r: any) => visibleNames.includes(r.name))
  return (
    <View style={{ flexDirection: 'row', backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 4 }}>
      {visibleRoutes.map((route: any, index: number) => {
        const tab = VISIBLE_TABS.find(t => t.name === route.name)
        const isFocused = state.index === state.routes.indexOf(route)
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key })
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name)
        }
        return (
          <TouchableOpacity key={route.key} onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 20, opacity: isFocused ? 1 : 0.5 }}>{tab?.icon}</Text>
            <Text style={{ fontSize: 10, color: isFocused ? COLORS.highlight : COLORS.textMuted, marginTop: 2, fontWeight: isFocused ? '700' : '400' }}>
              {tab?.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={props => <MyTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: COLORS.highlight,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tab.Screen name="Inicio" component={HomeStackScreen}
        options={{ headerShown: false }} />
      <Tab.Screen name="Mapa" component={MapStackScreen}
        options={{ headerShown: false }} />
      <Tab.Screen name="Camara" component={CameraStackScreen}
        options={{ headerShown: false }}
        listeners={({ navigation }) => ({
          tabPress: () => { navigation.reset({ index: 0, routes: [{ name: 'Camara' }] }) },
        })} />
      <Tab.Screen name="Muestras" component={SamplesStackScreen}
        options={{ headerShown: false }} />
      <Tab.Screen name="AR" component={ARScreen}
        options={{ title: 'Realidad aumentada' }} />
      <Tab.Screen name="Más" component={MoreStackScreen}
        options={{ headerShown: false }} />
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
