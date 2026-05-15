import { type FirebaseApp, getApps, initializeApp } from "firebase/app"
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth"
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
} from "firebase/firestore"
import {
  type FirebaseStorage,
  connectStorageEmulator,
  getStorage,
} from "firebase/storage"

/*
 * Browser-side Firebase client. Lazy-initialised, double-init safe.
 *
 * Auto-connects to the Firebase Emulator Suite when NEXT_PUBLIC_USE_EMULATORS=1
 * (set by `pnpm dev`). The placeholders in .env.local are enough for the SDK
 * to initialise — the connect* calls then redirect every request to localhost.
 *
 * Phase 7 swaps the placeholders for real Firebase project credentials and
 * NEXT_PUBLIC_USE_EMULATORS is left unset.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"

let app: FirebaseApp | undefined
let firestore: Firestore | undefined
let auth: Auth | undefined
let storage: FirebaseStorage | undefined

export function getClientApp(): FirebaseApp {
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig)
  }
  return app
}

export function getClientDb(): Firestore {
  if (!firestore) {
    const app = getClientApp()
    try {
      firestore = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
      })
    } catch {
      firestore = getFirestore(app)
    }
    if (useEmulators) {
      try {
        connectFirestoreEmulator(firestore, "127.0.0.1", 8080)
      } catch {
        /* Already connected — safe to ignore. */
      }
    }
  }
  return firestore
}

export function getClientAuth(): Auth {
  if (!auth) {
    auth = getAuth(getClientApp())
    if (useEmulators) {
      try {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
      } catch {
        /* Already connected. */
      }
    }
  }
  return auth
}

export function getClientStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getClientApp())
    if (useEmulators) {
      try {
        connectStorageEmulator(storage, "127.0.0.1", 9199)
      } catch {
        /* Already connected. */
      }
    }
  }
  return storage
}
