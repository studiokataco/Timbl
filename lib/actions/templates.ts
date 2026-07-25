"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import {
  orgCategoriesPath,
  orgPostsPath,
  orgTemplatesPath,
} from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { embedIfChanged } from "@/lib/embeddings/embeddable"
import { getPostTypes } from "@/lib/post-types"
import { gateErrorToResult, requireFeature } from "@/lib/plans/gate"
import { writeAuditEvent } from "@/lib/telemetry/audit-events"
import {
  postType as postTypeEnum,
  templateCadence,
  type Post,
  type ServerActionResult,
  type Template,
} from "@/lib/schemas"

/*
 * Template mutations + the "use template" promote-to-post action that the
 * templates page invokes. Every action goes through getCurrentOrgId() and
 * writes under /organizations/{orgId}/...
 */

const createSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  categoryId: z.string().min(1),
  defaultPostType: postTypeEnum.default("grid"),
  defaultHashtags: z.array(z.string()).default([]),
  defaultCtaId: z.string().optional(),
  blurbTemplate: z.string().optional(),
  designTemplateCanvaUrl: z.string().url().optional(),
  cadence: templateCadence.default("ad-hoc"),
})

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) })

const useTemplateSchema = z.object({
  templateId: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function createTemplate(input: unknown): Promise<ServerActionResult> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  try {
    await requireFeature(orgId, "templates")
  } catch (err) {
    const gated = gateErrorToResult(err)
    if (gated) return gated
    throw err
  }
  const db = getDb()
  const id = parsed.data.id ?? slugify(parsed.data.name)
  const now = new Date().toISOString()
  const doc = {
    ...parsed.data,
    id,
    organizationId: orgId,
    createdAt: now,
    updatedAt: now,
  }
  await db.doc(`${orgTemplatesPath(orgId)}/${id}`).set(doc, { merge: true })
  const actor = await getCurrentUser()
  await writeAuditEvent({
    orgId,
    kind: "template.create",
    actorUserId: actor?.id ?? null,
    target: { type: "template", id, label: parsed.data.name },
  })
  try {
    await embedIfChanged("template", orgId, id, doc as Record<string, unknown>)
  } catch (err) {
    console.warn(`[embed] template create soft-fail: ${err instanceof Error ? err.message : err}`)
  }
  revalidatePath("/templates")
  return { ok: true, id }
}

export async function updateTemplate(input: unknown): Promise<ServerActionResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const { id, ...patch } = parsed.data
  const orgId = await getCurrentOrgId()
  const now = new Date().toISOString()
  const ref = getDb().doc(`${orgTemplatesPath(orgId)}/${id}`)
  await ref.set({ ...patch, updatedAt: now }, { merge: true })
  try {
    const after = await ref.get()
    if (after.exists) {
      await embedIfChanged("template", orgId, id, { ...after.data(), id } as Record<string, unknown>)
    }
  } catch (err) {
    console.warn(`[embed] template update soft-fail: ${err instanceof Error ? err.message : err}`)
  }
  revalidatePath("/templates")
  return { ok: true, id }
}

export async function deleteTemplate(id: string): Promise<ServerActionResult> {
  if (!id) return { ok: false, error: "No id" }
  const orgId = await getCurrentOrgId()
  const ref = getDb().doc(`${orgTemplatesPath(orgId)}/${id}`)
  const snap = await ref.get()
  const name = (snap.data()?.name as string | undefined) ?? id
  await ref.delete()
  const actor = await getCurrentUser()
  await writeAuditEvent({
    orgId,
    kind: "template.delete",
    actorUserId: actor?.id ?? null,
    target: { type: "template", id, label: name },
  })
  revalidatePath("/templates")
  return { ok: true, id }
}

/*
 * Promote a template to a post. Reads template + category, merges defaults,
 * stamps `templateId`, returns the new post id so the caller can open the
 * composer.
 */
export async function useTemplate(input: unknown): Promise<ServerActionResult> {
  const parsed = useTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getDb()

  const tmplRef = db.doc(`${orgTemplatesPath(orgId)}/${parsed.data.templateId}`)
  const tmplSnap = await tmplRef.get()
  if (!tmplSnap.exists) {
    return { ok: false, error: "Template not found" }
  }
  const tmpl = snapToData<Template>(tmplSnap)

  // Pull category for any defaults the template doesn't override.
  const catSnap = await db
    .doc(`${orgCategoriesPath(orgId)}/${tmpl.categoryId}`)
    .get()
  const cat = catSnap.exists
    ? snapToData<{
        defaultPostType?: Post["postType"]
        defaultHashtags?: string[]
        defaultCtaId?: string
        defaultLeadId?: string
      }>(catSnap)
    : null

  const postsRef = db.collection(orgPostsPath(orgId)).doc()
  const now = new Date().toISOString()

  const hashtags =
    tmpl.defaultHashtags.length > 0
      ? tmpl.defaultHashtags
      : cat?.defaultHashtags ?? []

  const doc: Post = {
    id: postsRef.id,
    organizationId: orgId,
    brandId: DEFAULT_BRAND_ID,
    scheduledDate: parsed.data.scheduledDate,
    status: "idea",
    categoryId: tmpl.categoryId,
    templateId: tmpl.id,
    postType: tmpl.defaultPostType ?? cat?.defaultPostType ?? "grid",
    brief: tmpl.name,
    blurb: tmpl.blurbTemplate,
    hashtags,
    ctaId: tmpl.defaultCtaId ?? cat?.defaultCtaId,
    leadUserId: cat?.defaultLeadId,
    assigneeId: user.id,
    canvaUrl: tmpl.designTemplateCanvaUrl,
    assetUrls: [],
    designLinks: [],
    channelStatuses: {},
    createdAt: now,
    updatedAt: now,
  }

  await postsRef.set(doc)
  revalidatePath("/calendar")
  revalidatePath("/templates")
  return { ok: true, id: postsRef.id }
}

const saveAsTemplateSchema = z.object({
  postId: z.string().min(1),
  name: z.string().min(1),
  cadence: templateCadence.default("ad-hoc"),
})

/*
 * Composer kebab → "Save as template". Reads the post, lifts blurb /
 * hashtags / postType / ctaId / categoryId, writes a new template doc.
 */
export async function saveAsTemplate(input: unknown): Promise<ServerActionResult> {
  const parsed = saveAsTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  try {
    await requireFeature(orgId, "templates")
  } catch (err) {
    const gated = gateErrorToResult(err)
    if (gated) return gated
    throw err
  }
  const db = getDb()

  const postSnap = await db.doc(`${orgPostsPath(orgId)}/${parsed.data.postId}`).get()
  if (!postSnap.exists) return { ok: false, error: "Post not found" }
  const post = snapToData<Post>(postSnap)

  if (!post.categoryId) {
    return { ok: false, error: "Post has no category - set one before saving" }
  }

  const id = slugify(parsed.data.name)
  const now = new Date().toISOString()
  const doc = {
    id,
    organizationId: orgId,
    name: parsed.data.name,
    categoryId: post.categoryId,
    defaultPostType: getPostTypes(post)[0] ?? "grid",
    defaultHashtags: post.hashtags ?? [],
    defaultCtaId: post.ctaId,
    blurbTemplate: post.blurb,
    designTemplateCanvaUrl: post.canvaUrl,
    cadence: parsed.data.cadence,
    createdAt: now,
    updatedAt: now,
  }
  await db.doc(`${orgTemplatesPath(orgId)}/${id}`).set(doc, { merge: true })
  try {
    await embedIfChanged("template", orgId, id, doc as Record<string, unknown>)
  } catch (err) {
    console.warn(`[embed] saveAsTemplate soft-fail: ${err instanceof Error ? err.message : err}`)
  }
  revalidatePath("/templates")
  return { ok: true, id }
}

export async function listTemplates(): Promise<WithId<Template>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgTemplatesPath(orgId))
    .orderBy("name", "asc")
    .get()
  return snap.docs.map((d) => snapToData<Template>(d))
}

const applyTemplateSchema = z.object({
  postId: z.string().min(1),
  templateId: z.string().min(1),
})

export async function applyTemplate(input: unknown): Promise<ServerActionResult> {
  const parsed = applyTemplateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const [tmplSnap, postSnap] = await Promise.all([
    db.doc(`${orgTemplatesPath(orgId)}/${parsed.data.templateId}`).get(),
    db.collection(orgPostsPath(orgId)).doc(parsed.data.postId).get(),
  ])
  if (!tmplSnap.exists) return { ok: false, error: "Template not found" }
  if (!postSnap.exists || postSnap.data()?.organizationId !== orgId) {
    return { ok: false, error: "Post not found" }
  }
  const tmpl = snapToData<Template>(tmplSnap)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { updatedAt: now, templateId: tmpl.id }
  if (tmpl.blurbTemplate) patch.blurb = tmpl.blurbTemplate
  if (tmpl.defaultHashtags?.length) patch.hashtags = tmpl.defaultHashtags
  if (tmpl.defaultPostType) patch.postType = tmpl.defaultPostType
  if (tmpl.defaultCtaId) patch.ctaId = tmpl.defaultCtaId
  if (tmpl.designTemplateCanvaUrl) patch.canvaUrl = tmpl.designTemplateCanvaUrl
  if (tmpl.categoryId && !postSnap.data()?.categoryId) patch.categoryId = tmpl.categoryId
  await db.collection(orgPostsPath(orgId)).doc(parsed.data.postId).update(patch)
  return { ok: true }
}
