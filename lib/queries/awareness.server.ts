import "server-only"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { awarenessDaysPath, orgPostsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { AwarenessDay } from "@/lib/schemas"

export async function fetchAwarenessDaysInRange(
  start: string,
  end: string,
): Promise<WithId<AwarenessDay>[]> {
  const snap = await getDb()
    .collection(awarenessDaysPath)
    .where("date", ">=", start)
    .where("date", "<=", end)
    .orderBy("date", "asc")
    .get()
  return snap.docs.map((d) => snapToData<AwarenessDay>(d))
}

/*
 * Returns awareness days in window plus a Set of awarenessDayIds that already
 * have at least one post linked. Lets the UI render an "isPlanned" indicator
 * without a per-row query.
 */
export async function fetchAwarenessWithPlannedStatus(
  start: string,
  end: string,
): Promise<{ days: WithId<AwarenessDay>[]; plannedIds: Set<string> }> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const [daysSnap, postsSnap] = await Promise.all([
    db
      .collection(awarenessDaysPath)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .orderBy("date", "asc")
      .get(),
    db
      .collection(orgPostsPath(orgId))
      .where("scheduledDate", ">=", start)
      .where("scheduledDate", "<=", end)
      .select("awarenessDayId")
      .get(),
  ])
  const plannedIds = new Set<string>()
  for (const d of postsSnap.docs) {
    const aid = d.get("awarenessDayId") as string | undefined
    if (aid) plannedIds.add(aid)
  }
  return { days: daysSnap.docs.map((d) => snapToData<AwarenessDay>(d)), plannedIds }
}
