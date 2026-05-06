import "server-only"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgTemplatesPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { Template } from "@/lib/schemas"

export async function fetchTemplates(): Promise<WithId<Template>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgTemplatesPath(orgId))
    .orderBy("name", "asc")
    .get()
  return snap.docs.map((d) => snapToData<Template>(d))
}
