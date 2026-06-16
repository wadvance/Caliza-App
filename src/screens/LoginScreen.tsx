import { useState } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { COLORS } from '../types/constants'
import { login, register } from '../services/authService'

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Complete todos los campos')
      return
    }
    setLoading(true)
    try {
      const ok = mode === 'login'
        ? await login(email, password)
        : await register(email, password)
      if (ok) {
        navigation.replace('MainTabs')
      } else {
        Alert.alert('Error', 'Credenciales inválidas')
      }
    } catch {
      navigation.replace('MainTabs')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.logo}>🗺️</Text>
        <Text style={styles.title}>GeoCaliza</Text>
        <Text style={styles.subtitle}>Exploración inteligente de caliza</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={COLORS.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{mode === 'login' ? 'Entrar' : 'Registrarse'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={styles.switchText}>
            {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.replace('MainTabs')}>
          <Text style={styles.skipText}>Entrar sin cuenta (offline)</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { color: COLORS.text, fontSize: 32, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  form: { paddingHorizontal: 32 },
  formTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  input: { backgroundColor: COLORS.surfaceLight, color: COLORS.text, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  submitBtn: { backgroundColor: COLORS.accent, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  switchText: { color: COLORS.accent, textAlign: 'center', marginTop: 16, fontSize: 14 },
  skipBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  skipText: { color: COLORS.textMuted, fontSize: 13 },
})
