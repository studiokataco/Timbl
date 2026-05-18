"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import {
  orgCategoriesPath,
  orgPostsPath,
  orgTemplatesPath,
} from "@/lib/firebase/paths"
import { snapToData } from "@/lib/firebase/serialize"
import { embedIfChanged } from "@/lib/embeddings/embeddable"
import {
  postType as postTypeEnum,
  templateCadence,
  type Post,
  type ServerActionResult,
  type Template,
} from "@/lib/schemas"

/*
 * Template mutations + the "use template" promote-to-post action that the
 * library page invokes. Every action goes through getCurrentOrgId() and
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
  try {
    await embedIfChanged("template", orgId, id, doc as Record<string, unknown>)
  } catch (err) {
    console.warn(`[embed] template create soft-fail: ${err instanceof Error ? err.message : err}`)
  }
  revalidatePath("/library")
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
  revalidatePath("/library")
  return { ok: true, id }
}

export async function deleteTemplate(id: string): Promise<ServerActionResult> {
  if (!id) return { ok: false, error: "No id" }
  const orgId = await getCurrentOrgId()
  await getDb().doc(`${orgTemplatesPath(orgId)}/${id}`).delete()
  revalidatePath("/library")
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
    channelStatuses: {},
    createdAt: now,
    updatedAt: now,
  }

  await postsRef.set(doc)
  revalidatePath("/calendar")
  revalidatePath("/library")
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
  const db = getDb()

  const postSnap = await db.doc(`${orgPostsPath(orgId)}/${parsed.data.postId}`).get()
  if (!postSnap.exists) return { ok: false, error: "Post not found" }
  const post = snapToData<Post>(postSnap)

  if (!post.categoryId) {
    return { ok: false, error: "Post has no category — set one before saving" }
  }

  const id = slugify(parsed.data.name)
  const now = new Date().toISOString()
  const doc = {
    id,
    organizationId: orgId,
    name: parsed.data.name,
    categoryId: post.categoryId,
    defaultPostType: post.postType ?? "grid",
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
  revalidatePath("/library")
  return { ok: true, id }
}
