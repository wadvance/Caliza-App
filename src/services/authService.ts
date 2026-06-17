import API_CONFIG, { getApiUrl, getAuthHeaders } from './api'
import { setSetting, getSetting } from './database'
import {
  supabaseLogin,
  supabaseRegister,
  supabaseLogout as supabaseLogoutFn,
  supabaseGetSession,
  supabaseGetUser,
} from './supabaseClient'

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
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 15000)
  )

  try {
    const data: any = await Promise.race([supabaseLogin(email, password), timeoutPromise])
    if (data.session) {
      setUserFromSupabase(data.session)
      currentMode = 'supabase'
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function register(email: string, password: string, fullName?: string): Promise<'ok' | 'email_confirmation' | 'error'> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 15000)
  )

  try {
    const data: any = await Promise.race([supabaseRegister(email, password, fullName || email.split('@')[0]), timeoutPromise])
    if (data.session) {
      setUserFromSupabase(data.session)
      currentMode = 'supabase'
      return 'ok'
    }
    if (data.user) {
      return 'email_confirmation'
    }
    return 'error'
  } catch {
    return 'error'
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
