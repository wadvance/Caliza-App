import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage'
import { Platform } from 'react-native'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCyYgL0VzcyvaM3-Zpn-7_t5ENCUU3XNUo',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'calizaapp.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'calizaapp',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'calizaapp.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '902292132906',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:902292132906:web:ab02906dd08f56d9ca9f53',
}

let app: FirebaseApp
let auth: Auth
let db: Firestore
let storage: FirebaseStorage

export function initFirebase(): void {
  if (app) return
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)

  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://localhost:9099')
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectStorageEmulator(storage, 'localhost', 9199)
  }
}

export function getFirebaseApp(): FirebaseApp { return app }
export function getFirebaseAuth(): Auth { return auth }
export function getFirebaseDb(): Firestore { return db }
export function getFirebaseStorage(): FirebaseStorage { return storage }
