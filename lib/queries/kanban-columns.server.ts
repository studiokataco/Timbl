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

export async function fetchKanbanColumnsWithCounts(): Promise<{
  columns: WithId<KanbanColumn>[]
  postCountByStatus: Record<string, number>
}> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const [colSnap, postSnap] = await Promise.all([
    db.collection(orgKanbanColumnsPath(orgId)).orderBy("sortOrder", "asc").get(),
    db.collection(`organizations/${orgId}/posts`).select("status").get(),
  ])
  const postCountByStatus: Record<string, number> = {}
  for (const d of postSnap.docs) {
    const status = d.get("status") as string | undefined
    if (!status) continue
    postCountByStatus[status] = (postCountByStatus[status] ?? 0) + 1
  }
  return {
    columns: colSnap.docs.map((d) => snapToData<KanbanColumn>(d)),
    postCountByStatus,
  }
}
