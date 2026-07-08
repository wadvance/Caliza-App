import { useState, useRef } from 'react'
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../types/constants'
import { login, register, forgotPassword } from '../services/authService'

const { width, height } = Dimensions.get('window')

type Mode = 'login' | 'register' | 'forgot'

export function LoginScreen({ navigation }: any) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const fadeAnim = useRef(new Animated.Value(1)).current

  const switchMode = (newMode: Mode) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setMode(newMode)
      setLoading(false)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start()
    })
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    if (!email.trim()) { Alert.alert('Error', 'Ingresa tu correo electrónico'); return }

    if (mode === 'forgot') {
      setLoading(true)
      const ok = await forgotPassword(email.trim())
      setLoading(false)
      if (ok) {
        Alert.alert(
          'Correo enviado',
          'Si el correo existe en el sistema, recibirás instrucciones para restablecer tu contraseña.',
          [{ text: 'OK', onPress: () => switchMode('login') }],
        )
      } else {
        Alert.alert('Error', 'No se pudo procesar la solicitud. Verifica tu conexión.')
      }
      return
    }

    if (!password) { Alert.alert('Error', 'Ingresa tu contraseña'); return }
    if (mode === 'register') {
      if (!fullName.trim()) { Alert.alert('Error', 'Ingresa tu nombre completo'); return }
      if (password.length < 6) { Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres'); return }
      if (password !== confirmPassword) { Alert.alert('Error', 'Las contraseñas no coinciden'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const ok = await login(email.trim(), password)
        if (ok) {
          navigation.replace('MainTabs')
        } else {
          setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña.')
        }
      } else {
        const result = await register(email.trim(), password, fullName.trim())
        if (result === 'ok') {
          navigation.replace('MainTabs')
        } else if (result === 'email_confirmation') {
          Alert.alert(
            'Revisa tu correo',
            'Hemos enviado un enlace de confirmación a tu correo electrónico. Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace para activar tu cuenta. Luego inicia sesión.',
            [{ text: 'Entendido', onPress: () => switchMode('login') }],
          )
        } else {
          setErrorMsg('No se pudo crear la cuenta. El correo podría ya estar registrado.')
        }
      }
    } catch {
      Alert.alert('Error', 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Background decoration */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={styles.bgCircle3} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🗺️</Text>
          </View>
          <Text style={styles.title}>GeoCaliza</Text>
          <Text style={styles.subtitle}>Exploración inteligente{'\n'}de recursos calcáreos</Text>
        </View>

        {/* Form */}
        <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>
          <Text style={styles.formTitle}>
            {mode === 'login' ? 'Bienvenido' : mode === 'register' ? 'Crear cuenta' : 'Recuperar contraseña'}
          </Text>
          <Text style={styles.formSubtitle}>
            {mode === 'login' ? 'Inicia sesión para continuar' : mode === 'register' ? 'Regístrate para comenzar' : 'Te enviaremos instrucciones'}
          </Text>

          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor={COLORS.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor={COLORS.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType={mode === 'forgot' ? 'done' : 'next'}
            autoComplete="off"
          />

          {mode !== 'forgot' && (
            <>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Contraseña"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType={mode === 'register' ? 'next' : 'done'}
                  autoComplete="off"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {mode === 'register' && (
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirmar contraseña"
                    placeholderTextColor={COLORS.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Enviar instrucciones'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Forgot password link */}
          {mode === 'login' && (
            <TouchableOpacity onPress={() => switchMode('forgot')} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Switch mode */}
          <TouchableOpacity
            onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
            style={styles.switchBtn}
          >
            <Text style={styles.switchText}>
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            </Text>
            <Text style={styles.switchLink}>
              {mode === 'login' ? ' Regístrate' : ' Inicia sesión'}
            </Text>
          </TouchableOpacity>

          {/* Offline skip */}
          {mode === 'login' && (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => navigation.replace('MainTabs')}
            >
              <Text style={styles.skipText}>Entrar sin conexión</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  // Background decoration
  bgCircle1: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: COLORS.accent + '15',
  },
  bgCircle2: {
    position: 'absolute',
    top: 160,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.highlight + '10',
  },
  bgCircle3: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.accent + '12',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  logo: {
    fontSize: 40,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#9090b0',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Form card
  formCard: {
    marginHorizontal: 24,
    backgroundColor: '#222244',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#3a3a6a',
  },
  formTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  formSubtitle: {
    color: '#9090b0',
    fontSize: 13,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#2e2e55',
    color: COLORS.text,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#3a3a6a',
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    backgroundColor: '#2e2e55',
    color: COLORS.text,
    borderRadius: 12,
    padding: 16,
    paddingRight: 48,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: '#3a3a6a',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Forgot password
  forgotBtn: {
    alignItems: 'center',
    marginTop: 12,
    padding: 4,
  },
  forgotText: {
    color: '#9090b0',
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#3a3a6a',
  },
  dividerText: {
    color: '#9090b0',
    fontSize: 12,
    marginHorizontal: 12,
  },

  // Error box
  errorBox: {
    backgroundColor: '#e9456022',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff6b81',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Switch mode
  switchBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#9090b0',
    fontSize: 14,
  },
  switchLink: {
    color: '#ff6b81',
    fontSize: 14,
    fontWeight: '600',
  },

  // Skip
  skipBtn: {
    marginTop: 16,
    padding: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  skipText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
})
