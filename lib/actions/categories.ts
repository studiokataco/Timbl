"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgCategoriesPath, orgPostsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { gateErrorToResult, requireFeature } from "@/lib/plans/gate"
import { writeAuditEvent } from "@/lib/telemetry/audit-events"
import {
  categorySchema,
  type Category,
  type ServerActionResult,
} from "@/lib/schemas"

/*
 * Category CRUD. Read path stays in /lib/queries; mutations live here so
 * /settings/categories can invoke them as server actions.
 *
 * Gating:
 *   - `create` requires the `customCategories` feature (Studio+). Existing
 *     seeded categories on a Free plan stay editable; users just can't add
 *     more.
 *   - `delete` cannot remove `system: true` rows (seeded defaults).
 *   - `delete` requires a reassignTo target if any posts still point at
 *     the category — protects against orphan FKs.
 */

const createInput = categorySchema
  .pick({
    name: true,
    slug: true,
    color: true,
    icon: true,
    description: true,
    defaultPostType: true,
    defaultHashtags: true,
    defaultCtaId: true,
    defaultLeadId: true,
  })
  .extend({
    displayOrder: z.number().int().nonnegative().optional(),
  })

const updateInput = createInput.partial().extend({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
})

const reorderInput = z.object({
  /* Ordered list of category ids. The array index becomes the new
   * displayOrder. Caller is responsible for sending the FULL set so
   * partial-reorder bugs can't leave gaps. */
  orderedIds: z.array(z.string().min(1)).min(1),
})

const deleteInput = z.object({
  id: z.string().min(1),
  /* Required when the category has posts. Validated against the org's
   * categories — must not be the same id, must exist. */
  reassignTo: z.string().optional(),
})

export async function listCategoriesForSettings(): Promise<WithId<Category>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgCategoriesPath(orgId))
    .orderBy("displayOrder", "asc")
    .get()
  return snap.docs.map((d) => snapToData<Category>(d))
}

export async function createCategory(input: unknown): Promise<ServerActionResult> {
  const parsed = createInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  try {
    await requireFeature(orgId, "customCategories")
  } catch (err) {
    const gated = gateErrorToResult(err)
    if (gated) return gated
    throw err
  }

  const db = getDb()
  const col = db.collection(orgCategoriesPath(orgId))

  /* Slug must be unique within the org. */
  const existing = await col.where("slug", "==", parsed.data.slug).limit(1).get()
  if (!existing.empty) {
    return { ok: false, error: "A category with that slug already exists." }
  }

  /* Append to the end when displayOrder isn't supplied. */
  let displayOrder = parsed.data.displayOrder ?? 0
  if (parsed.data.displayOrder === undefined) {
    const max = await col.orderBy("displayOrder", "desc").limit(1).get()
    displayOrder = (max.docs[0]?.data().displayOrder as number | undefined) ?? 0
    displayOrder = displayOrder + 1
  }

  const ref = col.doc()
  const now = new Date().toISOString()
  const doc: Category = {
    id: ref.id,
    organizationId: orgId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    color: parsed.data.color,
    icon: parsed.data.icon,
    description: parsed.data.description,
    defaultPostType: parsed.data.defaultPostType ?? "grid",
    defaultHashtags: parsed.data.defaultHashtags ?? [],
    defaultCtaId: parsed.data.defaultCtaId,
    defaultLeadId: parsed.data.defaultLeadId,
    isActive: true,
    displayOrder,
    /* User-created categories are deletable; only seeds set system. */
    system: false,
    createdAt: now,
    updatedAt: now,
  }
  await ref.set(doc)
  const actor = await getCurrentUser()
  await writeAuditEvent({
    orgId,
    kind: "category.create",
    actorUserId: actor?.id ?? null,
    target: { type: "category", id: doc.id, label: doc.name },
  })
  revalidatePath("/settings/categories")
  revalidatePath("/calendar")
  return { ok: true, id: ref.id }
}

export async function updateCategory(input: unknown): Promise<ServerActionResult> {
  const parsed = updateInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const { id, ...patch } = parsed.data
  const ref = db.doc(`${orgCategoriesPath(orgId)}/${id}`)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "Category not found" }

  /* If slug is changing, enforce uniqueness. */
  if (patch.slug && patch.slug !== snap.data()?.slug) {
    const existing = await db
      .collection(orgCategoriesPath(orgId))
      .where("slug", "==", patch.slug)
      .limit(1)
      .get()
    if (!existing.empty) {
      return { ok: false, error: "A category with that slug already exists." }
    }
  }

  await ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true })
  revalidatePath("/settings/categories")
  revalidatePath("/calendar")
  return { ok: true, id }
}

export async function reorderCategories(input: unknown): Promise<ServerActionResult> {
  const parsed = reorderInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const batch = db.batch()
  parsed.data.orderedIds.forEach((id, index) => {
    batch.set(
      db.doc(`${orgCategoriesPath(orgId)}/${id}`),
      { displayOrder: index, updatedAt: new Date().toISOString() },
      { merge: true },
    )
  })
  await batch.commit()
  revalidatePath("/settings/categories")
  revalidatePath("/calendar")
  return { ok: true }
}

export async function deleteCategory(input: unknown): Promise<ServerActionResult> {
  const parsed = deleteInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const ref = db.doc(`${orgCategoriesPath(orgId)}/${parsed.data.id}`)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "Category not found" }

  if (snap.data()?.system === true) {
    return { ok: false, error: "System categories cannot be deleted." }
  }

  /* Count posts still pointing at this category. Bounded read so an
   * org with 10k posts doesn't stall the UI. */
  const linked = await db
    .collection(orgPostsPath(orgId))
    .where("categoryId", "==", parsed.data.id)
    .limit(1)
    .get()

  if (!linked.empty) {
    if (!parsed.data.reassignTo) {
      return {
        ok: false,
        error:
          "Category has posts. Pick a category to reassign them to before deleting.",
      }
    }
    if (parsed.data.reassignTo === parsed.data.id) {
      return { ok: false, error: "Cannot reassign posts to the category being deleted." }
    }
    const target = await db
      .doc(`${orgCategoriesPath(orgId)}/${parsed.data.reassignTo}`)
      .get()
    if (!target.exists) {
      return { ok: false, error: "Reassign target category not found." }
    }

    /* Reassign in pages of 400 (Firestore batch limit is 500; leave
     * headroom for the eventual category-delete and audit writes). */
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined
    while (true) {
      let q = db
        .collection(orgPostsPath(orgId))
        .where("categoryId", "==", parsed.data.id)
        .orderBy("__name__")
        .limit(400)
      if (cursor) q = q.startAfter(cursor)
      const page = await q.get()
      if (page.empty) break
      const batch = db.batch()
      page.docs.forEach((d) => {
        batch.set(
          d.ref,
          { categoryId: parsed.data.reassignTo, updatedAt: new Date().toISOString() },
          { merge: true },
        )
      })
      await batch.commit()
      if (page.size < 400) break
      cursor = page.docs[page.docs.length - 1]
    }
  }

  const deletedName = (snap.data()?.name as string | undefined) ?? parsed.data.id
  await ref.delete()
  const actor = await getCurrentUser()
  await writeAuditEvent({
    orgId,
    kind: "category.delete",
    actorUserId: actor?.id ?? null,
    target: { type: "category", id: parsed.data.id, label: deletedName },
    meta: parsed.data.reassignTo ? { reassignedTo: parsed.data.reassignTo } : {},
  })
  revalidatePath("/settings/categories")
  revalidatePath("/calendar")
  return { ok: true, id: parsed.data.id }
}
