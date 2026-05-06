import "server-only"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgKanbanColumnsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { KanbanColumn } from "@/lib/schemas"

export async function fetchKanbanColumns(): Promise<WithId<KanbanColumn>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgKanbanColumnsPath(orgId))
    .orderBy("sortOrder", "asc")
    .get()
  return snap.docs.map((d) => snapToData<KanbanColumn>(d))
}
