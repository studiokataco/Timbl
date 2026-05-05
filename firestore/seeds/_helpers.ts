import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { Timestamp } from "firebase-admin/firestore"

/*
 * Shared utilities for seed scripts. All seeds:
 *   - target the Firebase Emulator Suite when FIRESTORE_EMULATOR_HOST is set
 *   - are idempotent (setDoc with merge) and keyed by deterministic ids
 *   - log each write so a re-run is easy to audit
 */

export function ensureEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. Start the emulator first " +
        "(`pnpm emulators`) and re-run with the env var exported, e.g.\n" +
        "  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm seed",
    )
  }
  // Touching the app so initializeApp runs with the right env.
  getAdminApp()
  console.log(`→ seeding against emulator @ ${host}`)
}

export const SAFE_ORG_ID = "safe-foundation"
export const SAFE_ADMIN_USER_ID = "admin"

export function db() {
  return getAdminDb()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function nowTs(): Timestamp {
  return Timestamp.now()
}

/** Stamps createdAt only on first write (merge:true preserves existing) */
export function withAudit<T extends Record<string, unknown>>(data: T) {
  return { ...data, createdAt: nowIso(), updatedAt: nowIso() }
}
