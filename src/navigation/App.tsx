import { Component, useEffect, useState } from 'react'
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native'
import AppNavigator from './AppNavigator'
import { initDatabase } from '../services/database'
import { initAuth } from '../services/authService'
import { startAutoSync, onNetworkChange, syncNow } from '../services/syncService'
import { COLORS } from '../types/constants'

class ErrorBoundary extends Component<{ children: any }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0f0f23', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#e94560', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            Error en la aplicación
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
            {this.state.error?.message || 'Error desconocido'}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: COLORS.highlight, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([initDatabase(), initAuth()]).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    const clearAutoSync = startAutoSync()
    let clearNetwork: (() => void) | undefined
    onNetworkChange(connected => {
      if (connected) syncNow()
    }).then(fn => { clearNetwork = fn })
    return () => {
      clearAutoSync()
      if (clearNetwork) clearNetwork()
    }
  }, [ready])

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f23', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f23' }}>
      <ErrorBoundary>
        <AppNavigator />
      </ErrorBoundary>
    </View>
  )
}
