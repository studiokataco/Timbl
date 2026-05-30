import {
  type App,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app"
import { type Auth, getAuth } from "firebase-admin/auth"
import { type Firestore, getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"

const firestoreSettingsApplied = new WeakSet<Firestore>()

/*
 * Server-side Firebase Admin SDK. Used by:
 *   - Next.js server actions (lib/actions/*) during the dev-shim phase
 *   - Seed scripts (firestore/seeds/*)
 *   - The CSV migration script (scripts/migrate-from-csv.ts)
 *
 * Admin SDK BYPASSES Firestore Security Rules. App-layer scoping
 * via getCurrentOrgId() is the ONLY isolation guarantee until Phase 7,
 * when server actions swap to a user-scoped client and Rules engage as
 * a second defense layer.
 *
 * Credential resolution:
 *   1. FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON env var (single-line JSON)
 *   2. Application default credentials (works automatically against the
 *      Firebase Emulator Suite when FIRESTORE_EMULATOR_HOST is set)
 */

let adminApp: App | undefined

function resolveCredential() {
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON
  if (!json) return undefined
  try {
    return cert(JSON.parse(json))
  } catch (err) {
    throw new Error(
      `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
}

export function getAdminApp(): App {
  if (!adminApp) {
    const existing = getApps()[0]
    if (existing) {
      adminApp = existing
    } else {
      const credential = resolveCredential()
      adminApp = initializeApp(
        credential
          ? {
              credential,
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            }
          : {
              // Emulator path - works without credentials when the
              // FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
              // env vars are set.
              projectId:
                process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
                "social-media-planner-dev",
            },
      )
    }
  }
  return adminApp
}

export function getAdminDb(): Firestore {
  const db = getFirestore(getAdminApp())
  if (!firestoreSettingsApplied.has(db)) {
    try {
      db.settings({ ignoreUndefinedProperties: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes("already been initialized")) throw err
    }
    firestoreSettingsApplied.add(db)
  }
  return db
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function getAdminStorage() {
  return getStorage(getAdminApp())
}
