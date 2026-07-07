# Guía de migración Supabase → Firebase

## Paso 1: Crear proyecto en Firebase Console

1. Ve a https://console.firebase.google.com/
2. Haz clic en **"Crear un proyecto"** (o selecciona uno existente)
3. Sigue los pasos (puedes desactivar Google Analytics si no lo necesitas)

## Paso 2: Registrar la app (Android/iOS/Web)

### Para la app React Native (Firebase Web SDK):
1. En Firebase Console, haz clic en el icono **Web** (`</>`)
2. Registra la app con el nombre "CalizaApp"
3. Firebase te mostrará las credenciales. **Copia este objeto `firebaseConfig`**:
```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "1:..."
}
```

## Paso 3: Crear archivo `.env` en el frontend

Crea el archivo `CalizaApp\.env` (junto a `.env.example`) con este contenido:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIza... (copia de arriba)
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=1:...
```

## Paso 4: Activar Authentication (Email/Password)

1. En Firebase Console → **Authentication** → **Sign-in method**
2. Haz clic en **Email/Password**
3. Actívalo y guarda

## Paso 5: Descargar Service Account (para el backend)

1. Firebase Console → ⚙️ Settings (junto a Project Overview) → **Service accounts**
2. Haz clic en **"Generate new private key"**
3. Se descargará un archivo JSON
4. Cópialo a: `CalizaApp\backend\firebase-service-account.json`

## Paso 6: Activar Firestore

1. Firebase Console → **Firestore Database** → **Create database**
2. Elige **Start in test mode** (para desarrollo)
3. Selecciona la región más cercana a ti

## Paso 7: Activar Storage

1. Firebase Console → **Storage** → **Get started**
2. Elige **Start in test mode**
3. Selecciona la región

## Paso 8: Verificar instalación

### Frontend:
```bash
cd CalizaApp
npx expo start --web
```
La app debería arrancar sin errores de Firebase. Verifica que login/register funcionen.

### Backend:
```bash
cd CalizaApp\backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
El backend debería arrancar en http://localhost:8000

## Paso 9: Configurar EAS Build (si usas Expo EAS)

En `eas.json` ya están las variables `@firebase_*` con prefijo `@`. En el dashboard de EAS:
1. Ve a https://expo.dev → tu proyecto → **Secrets**
2. Agrega cada variable como secreto:
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`

## Colecciones en Firestore

Las colecciones se crean automáticamente al primer uso. El schema es:

| Colección | Documento |
|-----------|-----------|
| `users` | `{ email, fullName, role, isActive, createdAt }` |
| `samples` | `{ userId, photoUrls, latitude, longitude, altitude, operatorName, notes, estimatedRockType, acidReaction, hardness, color, texture, stratification, fossilPresence, estimatedCaco3, labCaco3, labMgo, labSio2, labAl2o3, labFe2o3, labLoi, labMoisture, labDate, labName, confidenceLevel, status, synced, createdAt, updatedAt }` |
| `calizaZones` | `{ userId, name, coordinates, probability, confidence, source, createdAt }` |
| `fieldObservations` | `{ userId, type, description, photos, latitude, longitude, createdAt }` |
| `satelliteAnalyses` | `{ userId, latitude, longitude, source, ndvi, clayRatio, carbonateIndex, quartzIndex, zones, createdAt }` |
| `syncLogs` | `{ userId, synced, errors, status, createdAt }` |
| `explorationReports` | `{ userId, title, author, dateRange, statistics, samples, zones, status, createdAt }` |

## Notas importantes

- Las contraseñas se manejan completamente desde Firebase Auth, **nunca se almacenan en Firestore**
- Las fotos se suben a **Firebase Storage** (no más Supabase Storage)
- El backend usa **Firebase Admin SDK** para verificar tokens y operaciones administrativas
- La app funciona offline (SQLite local) y sincroniza cuando hay conexión
