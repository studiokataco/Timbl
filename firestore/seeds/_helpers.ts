import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import {
  DEMO_ADMIN_USER_ID,
  TIMBL_DEMO_ORG_ID,
} from "@/lib/constants/timbl"
import { Timestamp } from "firebase-admin/firestore"

export { DEMO_ADMIN_USER_ID, TIMBL_DEMO_ORG_ID }

export function ensureEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  if (!host) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. Start the emulator first " +
        "(`pnpm emulators`) and re-run with the env var exported, e.g.\n" +
        "  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm seed",
    )
  }
  getAdminApp()
  console.log(`→ seeding against emulator @ ${host}`)
}

export const TENANT_ORG_ID = "tenant-workspace"
export const TENANT_ADMIN_USER_ID = "admin"

export function db() {
  return getAdminDb()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function nowTs(): Timestamp {
  return Timestamp.now()
}

export function withAudit<T extends Record<string, unknown>>(data: T) {
  return { ...data, createdAt: nowIso(), updatedAt: nowIso() }
}
