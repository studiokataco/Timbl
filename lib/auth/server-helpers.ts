import { getAdminDb } from "@/lib/firebase/admin"
import { DEV_SESSION, type DevOrganisation, type DevUser } from "./dev-session"

/*
 * Single chokepoint for "who is the current user / org" on the server.
 * Every server action and server-component data fetch MUST go through these
 * helpers — they are the only thing the Phase 7 auth swap will need to touch.
 *
 * Until Phase 7:
 *   - getCurrentUser() / getCurrentOrgId() return the dev shim values.
 *   - getDb() returns the Admin SDK Firestore client, which bypasses Security
 *     Rules. Org isolation is enforced ONLY by app-layer scoping — every write
 *     must land under /organizations/{getCurrentOrgId()}/...
 *
 * In Phase 7:
 *   - getCurrentUser() reads the verified Firebase ID token from cookies and
 *     looks up the matching public.users doc.
 *   - getDb() returns a user-scoped Firestore client; Security Rules then
 *     enforce isolation as a second defense layer.
 */

export async function getCurrentUser(): Promise<DevUser> {
  return DEV_SESSION.user
}

export async function getCurrentOrgId(): Promise<string> {
  return DEV_SESSION.organisation.id
}

export async function getCurrentOrganisation(): Promise<DevOrganisation> {
  return DEV_SESSION.organisation
}

export function getDb() {
  return getAdminDb()
}
