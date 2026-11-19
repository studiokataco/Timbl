"use server"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgPostReadsPath, orgUsersPath } from "@/lib/firebase/paths"

export type PostRead = { postId: string; userId: string; lastReadAt: string }

export async function listPostReads(): Promise<PostRead[]> {
  const orgId = await getCurrentOrgId()
  const users = await getDb().collection(orgUsersPath(orgId)).get()
  const out: PostRead[] = []
  await Promise.all(
    users.docs.map(async (user) => {
      const reads = await getDb().collection(orgPostReadsPath(orgId, user.id)).get()
      for (const doc of reads.docs) {
        const lastReadAt = doc.data().lastReadAt
        if (typeof lastReadAt === "string") {
          out.push({ postId: doc.id, userId: user.id, lastReadAt })
        }
      }
    }),
  )
  return out
}
