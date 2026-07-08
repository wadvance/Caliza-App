import { initFirebase, getFirebaseAuth, getFirebaseDb } from './firebaseConfig'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'

try {
  initFirebase()
} catch (e) {
  console.error('[authService] Firebase init error:', e)
}

const auth = getFirebaseAuth()
const db = getFirebaseDb()

type AuthMode = 'firebase' | 'mock'
let currentMode: AuthMode = 'firebase'
let currentUser: { id: string; email: string; full_name: string; role: string } | null = null

function setUser(firebaseUser: User | null) {
  if (firebaseUser) {
    currentUser = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      full_name: (firebaseUser as any).displayName || firebaseUser.email?.split('@')[0] || '',
      role: 'operator',
    }
  } else {
    currentUser = null
  }
}

export function initAuth(): Promise<void> {
  console.log('[initAuth] Firebase auth mode')
  return new Promise((resolve) => {
    if (!auth) {
      console.error('[initAuth] auth is undefined, skipping')
      resolve()
      return
    }
    onAuthStateChanged(auth, async (user) => {
      console.log('[initAuth] Auth state changed:', user ? user.uid : 'none')
      if (user) {
        setUser(user)
        currentMode = 'firebase'
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            currentUser = {
              id: user.uid,
              email: userDoc.data().email || user.email || '',
              full_name: userDoc.data().fullName || user.displayName || user.email?.split('@')[0] || '',
              role: userDoc.data().role || 'operator',
            }
          }
        } catch (e) {
          console.error('[initAuth] user doc error:', e)
        }
      }
      resolve()
    })
  })
}

export async function signInWithGoogle(): Promise<boolean> {
  try {
    const provider = new GoogleAuthProvider()
    const cred = await signInWithPopup(auth, provider)
    setUser(cred.user)
    currentMode = 'firebase'

    const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: cred.user.email,
        fullName: cred.user.displayName || cred.user.email?.split('@')[0] || '',
        role: 'operator',
        createdAt: serverTimestamp(),
      })
    }
    return true
  } catch {
    return false
  }
}

export async function login(email: string, password: string): Promise<boolean> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    setUser(cred.user)
    currentMode = 'firebase'
    return true
  } catch {
    return false
  }
}

export async function register(email: string, password: string, fullName?: string): Promise<'ok' | 'email_confirmation' | 'error'> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const name = fullName || email.split('@')[0]
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      fullName: name,
      role: 'operator',
      createdAt: serverTimestamp(),
    })
    setUser(cred.user)
    currentUser = { ...currentUser!, full_name: name }
    currentMode = 'firebase'
    return 'ok'
  } catch (e: any) {
    console.error('[register] Error:', e.code, e.message)
    if (e.code === 'auth/email-already-in-use') return 'email_confirmation'
    return 'error'
  }
}

export function getToken(): string | null {
  return currentUser?.id || null
}

export function getUser(): typeof currentUser {
  return currentUser
}

export function isAuthenticated(): boolean {
  return auth.currentUser !== null
}

export function getAuthMode(): AuthMode {
  return currentMode
}

export async function forgotPassword(email: string): Promise<boolean> {
  try {
    await sendPasswordResetEmail(auth, email)
    return true
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  await signOut(auth)
  currentUser = null
}
