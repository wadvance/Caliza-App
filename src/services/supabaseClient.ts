import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://scpmyuvcqsjfcrehwzsl.supabase.co'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcG15dXZjcXNqZmNyZWh3enNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MzU5MTYsImV4cCI6MjA5NzIxMTkxNn0.36nY5hWiyRfSic8iof7XqtNW506M82ovnYYnA999WRc'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
})

export default supabase

export async function supabaseLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function supabaseRegister(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: 'operator' } },
  })
  if (error) throw error
  return data
}

export async function supabaseLogout() {
  await supabase.auth.signOut()
}

export async function supabaseGetSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function supabaseGetUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export function supabaseOnAuth(callback: (event: any, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback)
}
