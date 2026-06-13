export const dynamic = "force-dynamic"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { orgIdeationFeedPath, orgPostsPath } from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import { ideationItemSchema, type IdeationItem } from "@/lib/schemas/ideationItem"
import type { Post } from "@/lib/schemas/post"
import type { WithId } from "@/lib/firebase/serialize"
import { PageHeader } from "@/components/shared/page-header"
import { IdeationBoard } from "@/components/ideation/board"

export default async function IdeationPage() {
  const orgId = await getCurrentOrgId()
  const db = getAdminDb()

  const [ideasSnap, postsSnap] = await Promise.all([
    db.collection(orgIdeationFeedPath(orgId)).where("status", "==", "new").orderBy("createdAt", "desc").limit(100).get(),
    db.collection(orgPostsPath(orgId)).where("status", "in", ["draft", "scheduled"]).orderBy("scheduledDate", "asc").limit(200).get(),
  ])

  const ideas: WithId<IdeationItem>[] = []
  for (const d of ideasSnap.docs) {
    const r = ideationItemSchema.safeParse({ ...(d.data() ?? {}), id: d.id, organizationId: orgId })
    if (r.success) ideas.push(r.data as WithId<IdeationItem>)
  }

  const allPosts = postsSnap.docs.map((d) => snapToData<Post>(d))
  const drafts = allPosts.filter((p) => p.status === "draft")
  const scheduled = allPosts.filter((p) => p.status === "scheduled")

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 sm:px-10 py-10 lg:py-14 pb-4">
        <PageHeader
          title="Ideation"
          description="Drag ideas into drafts to promote them, then schedule when ready."
        />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <IdeationBoard ideas={ideas} drafts={drafts} scheduled={scheduled} />
      </div>
    </div>
  )
}
