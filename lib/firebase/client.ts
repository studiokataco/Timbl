import { type FirebaseApp, getApps, initializeApp } from "firebase/app"
import { type Auth, getAuth } from "firebase/auth"
import { type Firestore, getFirestore } from "firebase/firestore"
import { type FirebaseStorage, getStorage } from "firebase/storage"

/*
 * Browser-side Firebase client. Lazy-initialised, double-init safe.
 *
 * Until real auth lands in Phase 7 the app is auto-signed in via
 * lib/auth/dev-session.ts and reads/writes hit the Firebase Emulator Suite,
 * not a production project. The values in NEXT_PUBLIC_FIREBASE_* during dev
 * are placeholders — pointing the SDK at emulator hosts is what makes calls
 * succeed.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

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
  if (!firestore) firestore = getFirestore(getClientApp())
  return firestore
}

export function getClientAuth(): Auth {
  if (!auth) auth = getAuth(getClientApp())
  return auth
}

export function getClientStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getClientApp())
  return storage
}
