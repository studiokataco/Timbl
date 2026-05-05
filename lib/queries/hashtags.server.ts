import "server-only"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgPostsPath } from "@/lib/firebase/paths"

/*
 * Recent hashtags across the org, deduped, ordered by most-recent use.
 * Used by the composer's hashtag input as autocomplete suggestions
 * alongside the selected category's defaultHashtags.
 */
export async function fetchRecentHashtags(limit = 50): Promise<string[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgPostsPath(orgId))
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get()
  const seen = new Set<string>()
  for (const d of snap.docs) {
    const tags = (d.data().hashtags ?? []) as string[]
    for (const t of tags) seen.add(t)
  }
  return Array.from(seen).slice(0, 100)
}
