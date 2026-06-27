"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgPostChecklistPath } from "@/lib/firebase/paths"
import { checklistItemSchema, type ChecklistItem } from "@/lib/schemas/checklistItem"
import type { ServerActionResult } from "@/lib/schemas"
import { snapToData } from "@/lib/firebase/serialize"

export async function fetchChecklist(postId: string): Promise<ChecklistItem[]> {
  const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
  const snap = await db
    .collection(orgPostChecklistPath(orgId, postId))
    .orderBy("sortOrder", "asc")
    .get()
  return snap.docs.map((d) => snapToData<ChecklistItem>(d))
}

export async function addChecklistItem(input: {
  postId: string
  label: string
}): Promise<ServerActionResult> {
  try {
    const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
    const col = db.collection(orgPostChecklistPath(orgId, input.postId))
    const { label } = checklistItemSchema.pick({ label: true }).parse({ label: input.label })
    const existing = await col.orderBy("sortOrder", "desc").limit(1).get()
    const sortOrder = existing.empty ? 0 : ((existing.docs[0].data().sortOrder as number) ?? 0) + 1
    const now = new Date().toISOString()
    const ref = col.doc()
    await ref.set({ id: ref.id, postId: input.postId, label, done: false, sortOrder, createdAt: now, updatedAt: now })
    revalidatePath("/posts")
    return { ok: true, id: ref.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function toggleChecklistItem(input: {
  postId: string
  itemId: string
  done: boolean
}): Promise<ServerActionResult> {
  try {
    const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
    await db
      .doc(`${orgPostChecklistPath(orgId, input.postId)}/${input.itemId}`)
      .set({ done: input.done, updatedAt: new Date().toISOString() }, { merge: true })
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function deleteChecklistItem(input: {
  postId: string
  itemId: string
}): Promise<ServerActionResult> {
  try {
    const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
    await db.doc(`${orgPostChecklistPath(orgId, input.postId)}/${input.itemId}`).delete()
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}
