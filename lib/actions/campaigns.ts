"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgCampaignsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { campaignSchema, type Campaign } from "@/lib/schemas"

const ServerActionResult = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
})
export type ServerActionResult = z.infer<typeof ServerActionResult>

const createSchema = campaignSchema.omit({ id: true, organizationId: true, createdAt: true, updatedAt: true })
const updateSchema = createSchema.partial().extend({ id: z.string().min(1) })

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function createCampaign(input: unknown): Promise<ServerActionResult> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }

  const orgId = await getCurrentOrgId()
  const db = getDb()
  const now = new Date().toISOString()
  const slug = parsed.data.slug || slugify(parsed.data.name)
  const ref = db.collection(orgCampaignsPath(orgId)).doc(slug)
  await ref.set({ ...parsed.data, slug, organizationId: orgId, createdAt: now, updatedAt: now })
  revalidatePath("/campaigns")
  return { ok: true, id: slug }
}

export async function updateCampaign(input: unknown): Promise<ServerActionResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }

  const { id, ...rest } = parsed.data
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const now = new Date().toISOString()
  await db.doc(`${orgCampaignsPath(orgId)}/${id}`).set({ ...rest, updatedAt: now }, { merge: true })
  revalidatePath("/campaigns")
  revalidatePath(`/campaigns/${id}`)
  return { ok: true, id }
}

export async function deleteCampaign(id: string): Promise<ServerActionResult> {
  if (!id) return { ok: false, error: "No id" }
  const orgId = await getCurrentOrgId()
  await getDb().doc(`${orgCampaignsPath(orgId)}/${id}`).delete()
  revalidatePath("/campaigns")
  return { ok: true }
}

export async function fetchCampaignWithPostCount(
  orgId: string,
): Promise<(WithId<Campaign> & { postCount: number; scheduledOrPosted: number })[]> {
  const db = getDb()
  const [campaignSnap, postSnap] = await Promise.all([
    db.collection(orgCampaignsPath(orgId)).get(),
    db.collection(`organizations/${orgId}/posts`).select("campaignId", "status").get(),
  ])
  const counts = new Map<string, { total: number; done: number }>()
  for (const d of postSnap.docs) {
    const cid = d.get("campaignId") as string | undefined
    if (!cid) continue
    const prev = counts.get(cid) ?? { total: 0, done: 0 }
    const status = d.get("status") as string
    counts.set(cid, {
      total: prev.total + 1,
      done: prev.done + (status === "scheduled" || status === "posted" ? 1 : 0),
    })
  }
  return campaignSnap.docs.map((d) => {
    const c = snapToData<Campaign>(d)
    const cnt = counts.get(c.id) ?? { total: 0, done: 0 }
    return { ...c, postCount: cnt.total, scheduledOrPosted: cnt.done }
  })
}
