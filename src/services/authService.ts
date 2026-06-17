import API_CONFIG, { getApiUrl, getAuthHeaders } from './api'
import { setSetting, getSetting } from './database'
import { Platform } from 'react-native'
import {
  supabaseLogin,
  supabaseRegister,
  supabaseLogout as supabaseLogoutFn,
  supabaseGetSession,
  supabaseGetUser,
} from './supabaseClient'

const isWeb = Platform.OS === 'web'

type AuthMode = 'mock' | 'supabase' | 'auto'
let currentMode: AuthMode = 'auto'
let currentToken: string | null = null
let currentUser: { id: string; email: string; full_name: string; role: string } | null = null

function setUserFromSupabase(sbUser: any) {
  currentToken = sbUser?.access_token || null
  currentUser = sbUser?.user ? {
    id: sbUser.user.id,
    email: sbUser.user.email || '',
    full_name: sbUser.user.user_metadata?.full_name || sbUser.user.email?.split('@')[0] || '',
    role: sbUser.user.user_metadata?.role || 'operator',
  } : null
}

export async function initAuth(): Promise<void> {
  // Try Supabase session first
  try {
    const session = await supabaseGetSession()
    if (session) {
      setUserFromSupabase(session)
      currentMode = 'supabase'
      return
    }
  } catch {}

  // Fallback to local JWT token
  const saved = await getSetting('auth_token')
  if (saved) {
    currentToken = saved
    try {
      const res = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH_ME), {
        headers: getAuthHeaders(currentToken!),
      })
      if (res.ok) {
        currentUser = await res.json()
        currentMode = 'mock'
      } else {
        currentToken = null
        await setSetting('auth_token', '')
      }
    } catch {
      currentToken = saved
    }
  }
}

export async function login(email: string, password: string): Promise<boolean> {
  // Try Supabase first
  try {
    const data = await supabaseLogin(email, password)
    if (data.session) {
      setUserFromSupabase(data.session)
      currentMode = 'supabase'
      return true
    }
  } catch {}

  // Fallback to mock server
  try {
    const res = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH_LOGIN), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) return false
    const data = await res.json()
    currentToken = data.access_token
    await setSetting('auth_token', currentToken!)

    const meRes = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH_ME), {
      headers: getAuthHeaders(currentToken!),
    })
    if (meRes.ok) {
      currentUser = await meRes.json()
    }
    currentMode = 'mock'
    return true
  } catch {
    return false
  }
}

export async function register(email: string, password: string, fullName?: string): Promise<boolean> {
  // Try Supabase first
  try {
    const data = await supabaseRegister(email, password, fullName || email.split('@')[0])
    if (data.session) {
      setUserFromSupabase(data.session)
      currentMode = 'supabase'
      return true
    }
    if (data.user) {
      // Email confirmation may be required — try logging in
      return login(email, password)
    }
  } catch {}

  // Fallback to mock server
  try {
    const res = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH_REGISTER), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        email,
        password,
        full_name: fullName || email.split('@')[0],
        role: 'operator',
      }),
    })
    if (!res.ok) return false
    return login(email, password)
  } catch {
    return false
  }
}

export function getToken(): string | null {
  return currentToken
}

export function getUser(): typeof currentUser {
  return currentUser
}

export function isAuthenticated(): boolean {
  return currentToken !== null
}

export function getAuthMode(): AuthMode {
  return currentMode
}

export async function forgotPassword(email: string): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/api/v1/auth/forgot-password'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return !!data.message
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  try { await supabaseLogoutFn() } catch {}
  currentToken = null
  currentUser = null
  currentMode = 'auto'
  await setSetting('auth_token', '')
}
