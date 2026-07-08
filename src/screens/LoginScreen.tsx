import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { COLORS } from '../types/constants'
import { signInWithGoogle, isAuthenticated } from '../services/authService'
import { getInstallPrompt, isPwaInstalled, triggerInstall } from '../services/pwaService'

export function LoginScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [installPrompt, setInstallPrompt] = useState<any>(null)

  useEffect(() => {
    if (isAuthenticated()) navigation.replace('MainTabs')
  }, [])

  useEffect(() => {
    setInstallPrompt(getInstallPrompt())
  }, [])

  const handleGoogle = async () => {
    setErrorMsg('')
    setLoading(true)
    try {
      await signInWithGoogle()
      navigation.replace('MainTabs')
    } catch (e: any) {
      console.error('[Login] Google sign-in error:', e?.code, e?.message)
      const code = e?.code || ''
      let msg = ''
      if (code === 'auth/unauthorized-domain') {
        msg = 'Agrega wadvance.github.io en Firebase Console → Authentication → Settings → Authorized domains, y habilita Google como proveedor.'
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'Habilita Google en Firebase Console → Authentication → Sign-in method.'
      } else if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        msg = 'El popup fue bloqueado o cerrado. Permite ventanas emergentes para este sitio e intenta de nuevo.'
      } else {
        msg = e?.message || 'Error al iniciar sesión con Google.'
      }
      setErrorMsg(msg)
      if (typeof window !== 'undefined') window.alert(msg)
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
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={styles.bgCircle3} />

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🗺️</Text>
          </View>
          <Text style={styles.title}>GeoCaliza</Text>
          <Text style={styles.subtitle}>Exploración inteligente{'\n'}de recursos calcáreos</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Bienvenido</Text>
          <Text style={styles.formSubtitle}>Inicia sesión para continuar</Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.googleBtn, loading && styles.disabledBtn]}
            onPress={handleGoogle}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <>
                <View style={styles.googleIconWrapper}>
                  <Text style={styles.googleIcon}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>Continuar con Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => navigation.replace('MainTabs')}
          >
            <Text style={styles.skipText}>Entrar sin conexión</Text>
          </TouchableOpacity>

          {!isPwaInstalled() && (
            <View style={styles.installSection}>
              {installPrompt ? (
                <TouchableOpacity style={styles.installBtn} onPress={async () => {
                  const ok = await triggerInstall()
                  if (ok) setInstallPrompt(null)
                }}>
                  <Text style={styles.installBtnText}>📲 Instalar aplicación</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <TouchableOpacity style={styles.installBtn}>
                    <Text style={styles.installBtnText}>📲 Instalar aplicación</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
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
  errorBox: {
    backgroundColor: '#e9456022',
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff6b81',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  googleIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '800',
  },
  googleBtnText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: '600',
  },
  skipBtn: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  skipText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  installSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  installBtn: {
    backgroundColor: COLORS.highlight,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  installBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
