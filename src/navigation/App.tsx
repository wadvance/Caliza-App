import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import AppNavigator from './AppNavigator'
import { initDatabase } from '../services/database'
import { initAuth } from '../services/authService'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([initDatabase(), initAuth()]).finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f23', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f23' }}>
      <AppNavigator />
    </View>
  )
}
