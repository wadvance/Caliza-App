import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage'
import { Platform } from 'react-native'

const firebaseConfig = {
  apiKey: 'AIzaSyCyYgL0VzcyvaM3-Zpn-7_t5ENCUU3XNUo',
  authDomain: 'calizaapp.firebaseapp.com',
  projectId: 'calizaapp',
  storageBucket: 'calizaapp.firebasestorage.app',
  messagingSenderId: '902292132906',
  appId: '1:902292132906:web:ab02906dd08f56d9ca9f53',
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
