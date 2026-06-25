import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { platformConfigDocPath } from "@/lib/platform/schema"

/*
 * Server-resolved decision for whether the client realtime listener should
 * engage for a given org. Realtime is strictly additive - surfaces always
 * render from server-fetched data - so this only gates the live-refresh
 * enhancement. Resolution order:
 *
 *   1. Emulator / dev shim  -> always OFF. Testing accounts have no real
 *      client auth user, so onSnapshot would only hit denied reads.
 *   2. Per-org flag `realtime_v1` set explicitly (true/false) -> wins. This is
 *      the no-redeploy kill-switch a platform owner flips from admin.timbl.
 *   3. Otherwise -> the global default (NEXT_PUBLIC_REALTIME_DEFAULT === "1"),
 *      OFF unless set. Lets GA start dark and ramp per-org.
 */
export async function realtimeEnabledForOrg(orgId: string): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1") return false

  const globalDefault = await resolveGlobalRealtimeDefault()

  try {
    const snap = await getAdminDb().doc(orgPath(orgId)).get()
    const flag = (snap.data()?.featureFlags ?? {})["realtime_v1"]
    if (typeof flag === "boolean") return flag
  } catch {
    /* Never let a flag read block the page - fall back to the global default. */
  }
  return globalDefault
}

async function resolveGlobalRealtimeDefault(): Promise<boolean> {
  const envDefault = process.env.NEXT_PUBLIC_REALTIME_DEFAULT === "1"
  try {
    const snap = await getAdminDb().doc(platformConfigDocPath).get()
    const flag = snap.data()?.realtimeDefault
    if (typeof flag === "boolean") return flag
  } catch {
    /* fall through to env */
  }
  return envDefault
}
