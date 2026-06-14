"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgKanbanColumnsPath, orgPostsPath } from "@/lib/firebase/paths"
import { isProtectedStatusId, type ServerActionResult } from "@/lib/schemas"

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected #rrggbb")
const labelSchema = z.string().trim().min(1).max(40)
const idSchema = z.string().trim().min(1)

const createInput = z.object({ label: labelSchema, color: colorSchema })
const renameInput = z.object({ id: idSchema, label: labelSchema })
const recolorInput = z.object({ id: idSchema, color: colorSchema })
const reorderInput = z.object({ ids: z.array(idSchema).min(1) })
const deleteInput = z.object({ id: idSchema, moveTo: idSchema })

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `col-${Date.now().toString(36)}`
  )
}

export async function createKanbanColumn(input: unknown): Promise<ServerActionResult> {
  const parsed = createInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }

  const orgId = await getCurrentOrgId()
  const db = getDb()
  const col = db.collection(orgKanbanColumnsPath(orgId))
  const existing = await col.orderBy("sortOrder", "desc").limit(1).get()
  const nextOrder = existing.empty ? 0 : (existing.docs[0].get("sortOrder") as number) + 1

  let id = slugify(parsed.data.label)
  // Suffix on collision so user-chosen labels can repeat
  const collision = await col.doc(id).get()
  if (collision.exists) id = `${id}-${Date.now().toString(36)}`

  const now = new Date().toISOString()
  await col.doc(id).set({
    id,
    organizationId: orgId,
    label: parsed.data.label,
    color: parsed.data.color,
    sortOrder: nextOrder,
    isSystemDefault: false,
    createdAt: now,
    updatedAt: now,
  })
  revalidatePath("/kanban")
  return { ok: true, id }
}

export async function renameKanbanColumn(input: unknown): Promise<ServerActionResult> {
  const parsed = renameInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }

  const orgId = await getCurrentOrgId()
  await getDb()
    .doc(`${orgKanbanColumnsPath(orgId)}/${parsed.data.id}`)
    .set({ label: parsed.data.label, updatedAt: new Date().toISOString() }, { merge: true })
  revalidatePath("/kanban")
  return { ok: true, id: parsed.data.id }
}

export async function recolorKanbanColumn(input: unknown): Promise<ServerActionResult> {
  const parsed = recolorInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }

  const orgId = await getCurrentOrgId()
  await getDb()
    .doc(`${orgKanbanColumnsPath(orgId)}/${parsed.data.id}`)
    .set({ color: parsed.data.color, updatedAt: new Date().toISOString() }, { merge: true })
  revalidatePath("/kanban")
  return { ok: true, id: parsed.data.id }
}

export async function reorderKanbanColumns(input: unknown): Promise<ServerActionResult> {
  const parsed = reorderInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }

  const orgId = await getCurrentOrgId()
  const db = getDb()
  const batch = db.batch()
  const now = new Date().toISOString()
  parsed.data.ids.forEach((id, index) => {
    batch.set(
      db.doc(`${orgKanbanColumnsPath(orgId)}/${id}`),
      { sortOrder: index, updatedAt: now },
      { merge: true },
    )
  })
  await batch.commit()
  revalidatePath("/kanban")
  return { ok: true }
}

export async function deleteKanbanColumn(input: unknown): Promise<ServerActionResult> {
  const parsed = deleteInput.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  if (parsed.data.id === parsed.data.moveTo) {
    return { ok: false, error: "Move-to column cannot equal the deleted column" }
  }
  if (isProtectedStatusId(parsed.data.id)) {
    return { ok: false, error: "This status is required by the publishing workflow and can't be deleted." }
  }

  const orgId = await getCurrentOrgId()
  const db = getDb()

  /* Re-status all posts whose status equals the deleted column id, then
   * delete the column doc. Done in a transaction so we never orphan posts.
   * Throws inside the callback are the only way to roll back, so we catch
   * at the outer boundary to translate them into the {ok,error} contract. */
  try {
    await db.runTransaction(async (tx) => {
      const colRef = db.doc(`${orgKanbanColumnsPath(orgId)}/${parsed.data.id}`)
      const moveToRef = db.doc(`${orgKanbanColumnsPath(orgId)}/${parsed.data.moveTo}`)
      const [colSnap, moveToSnap] = await Promise.all([tx.get(colRef), tx.get(moveToRef)])
      if (!colSnap.exists) throw new Error("Column not found")
      if (!moveToSnap.exists) throw new Error("Move-to column not found")

      const postsSnap = await tx.get(
        db.collection(orgPostsPath(orgId)).where("status", "==", parsed.data.id),
      )
      const now = new Date().toISOString()
      postsSnap.docs.forEach((p) => {
        tx.set(p.ref, { status: parsed.data.moveTo, updatedAt: now }, { merge: true })
      })
      tx.delete(colRef)
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed" }
  }
  revalidatePath("/kanban")
  return { ok: true }
}
