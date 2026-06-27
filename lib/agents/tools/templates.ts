import { z } from "zod"
import { FunctionTool } from "@google/adk"
import { randomUUID } from "node:crypto"

import { embedIfChanged } from "@/lib/embeddings/embeddable"
import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgCategoriesPath,
  orgPostsPath,
  orgTemplatesPath,
} from "@/lib/firebase/paths"
import { isoDate, nextActionKind, postPriority, postType } from "@/lib/schemas/_shared"
import { templateCadence } from "@/lib/schemas/template"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Template tool. Mirrors lib/actions/templates.ts (the UI path) but
 * writes through getAdminDb under the agent's runtime org, the same way the
 * post tools do. Lets the drafter turn a recurring idea (work anniversaries,
 * monthly recaps) into a reusable template instead of one-off draft posts.
 *
 * Templates require a categoryId. The agent rarely knows raw ids, so the
 * tool resolves a provided id or name against the org's categories and falls
 * back to the first category when none is given - never inventing one.
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

const createInput = z.object({
  name: z.string().min(1).max(120),
  categoryId: z
    .string()
    .optional()
    .describe(
      "Category id or name. If omitted, the org's first category is used.",
    ),
  blurbTemplate: z
    .string()
    .max(8_000)
    .optional()
    .describe(
      "The reusable copy, with [PLACEHOLDER] tokens the author fills in (eg. [TEAM_MEMBER], [YEARS]).",
    ),
  defaultHashtags: z.array(z.string().min(1).max(64)).max(40).default([]),
  defaultPostType: postType.default("grid"),
  defaultCtaId: z.string().optional(),
  designTemplateCanvaUrl: z.string().url().optional(),
  cadence: templateCadence.default("ad-hoc"),
})

export const createTemplateTool = new FunctionTool({
  name: "createTemplate",
  description:
    "Create a reusable template for recurring posts (eg. work anniversaries, monthly recaps). Use [PLACEHOLDER] tokens in blurbTemplate for the parts that change each time. Always include a name and a blurbTemplate.",
  parameters: createInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const db = getAdminDb()

    const catSnap = await db.collection(orgCategoriesPath(orgId)).get()
    if (catSnap.empty) {
      return {
        ok: false,
        error: "no_categories",
        message:
          "This workspace has no categories yet. Create a category before saving a template.",
      }
    }
    const categories = catSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data().name as string | undefined) ?? d.id,
    }))
    const wanted = input.categoryId?.toLowerCase()
    const resolved =
      (wanted &&
        categories.find(
          (c) => c.id.toLowerCase() === wanted || c.name.toLowerCase() === wanted,
        )) ||
      categories[0]

    const id = slugify(input.name)
    const now = new Date().toISOString()
    const doc = {
      id,
      organizationId: orgId,
      name: input.name,
      categoryId: resolved.id,
      defaultPostType: input.defaultPostType,
      defaultHashtags: input.defaultHashtags,
      defaultCtaId: input.defaultCtaId,
      blurbTemplate: input.blurbTemplate,
      designTemplateCanvaUrl: input.designTemplateCanvaUrl,
      cadence: input.cadence,
      createdAt: now,
      updatedAt: now,
    }
    await db.doc(`${orgTemplatesPath(orgId)}/${id}`).set(doc, { merge: true })
    try {
      await embedIfChanged("template", orgId, id, doc as Record<string, unknown>)
    } catch {
      /* embedIfChanged soft-fails internally; never break the tool result */
    }
    return { ok: true, templateId: id, categoryId: resolved.id }
  },
})

export const listTemplatesTool = new FunctionTool({
  name: "listTemplates",
  description:
    "List the org's reusable post templates so you can pick one to turn into a draft. Returns each template's id, name, cadence, categoryId, and a short preview of its blurbTemplate. Call this before useTemplate when you only know a template by name.",
  parameters: z.object({}),
  execute: async (_input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const snap = await getAdminDb().collection(orgTemplatesPath(orgId)).get()
    const templates = snap.docs.map((d) => {
      const t = d.data()
      const blurb = (t.blurbTemplate as string | undefined) ?? ""
      return {
        id: d.id,
        name: (t.name as string | undefined) ?? d.id,
        cadence: (t.cadence as string | undefined) ?? "ad-hoc",
        categoryId: (t.categoryId as string | undefined) ?? null,
        blurbPreview: blurb.length > 160 ? `${blurb.slice(0, 160)}...` : blurb,
      }
    })
    return { count: templates.length, templates }
  },
})

const useTemplateInput = z.object({
  template: z
    .string()
    .min(1)
    .describe("Template id or name. Resolved against the org's templates."),
  scheduledDate: isoDate,
  status: z.string().min(1).default("idea"),
  priority: postPriority.optional(),
  /* Overrides the template's blurb for this one post - placeholders the
   * template left as [TOKENS] should be filled in here, not left raw. */
  blurb: z.string().max(8_000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().max(4_000).optional(),
  reviewState: z.enum(["pending", "approved", "rejected"]).default("pending"),
  nextActionKind: nextActionKind.default("schedule_post"),
  nextActionChannel: z.string().optional(),
  nextActionTime: z.string().optional(),
})

export const useTemplateTool = new FunctionTool({
  name: "useTemplate",
  description:
    "Turn an existing template into a dated draft post. Resolves the template by id or name, merges its defaults (and the category's fallbacks), and writes a Post carrying agentMeta. Fill any [PLACEHOLDER] tokens by passing a finished `blurb` - never leave raw tokens in the post.",
  parameters: useTemplateInput,
  execute: async (input, ctx) => {
    const { orgId, runId, agentName } = getRuntimeCtx(ctx)
    const db = getAdminDb()

    const tmplSnap = await db.collection(orgTemplatesPath(orgId)).get()
    if (tmplSnap.empty) return { ok: false, error: "no_templates" }
    const wanted = input.template.toLowerCase()
    const tmplDoc =
      tmplSnap.docs.find((d) => d.id.toLowerCase() === wanted) ??
      tmplSnap.docs.find(
        (d) => (d.data().name as string | undefined)?.toLowerCase() === wanted,
      )
    if (!tmplDoc) return { ok: false, error: "template_not_found" }
    const tmpl = tmplDoc.data()

    const catSnap = tmpl.categoryId
      ? await db.doc(`${orgCategoriesPath(orgId)}/${tmpl.categoryId}`).get()
      : null
    const cat = catSnap?.exists ? catSnap.data() : null

    const hashtags =
      (tmpl.defaultHashtags as string[] | undefined)?.length
        ? (tmpl.defaultHashtags as string[])
        : (cat?.defaultHashtags as string[] | undefined) ?? []

    const id = randomUUID()
    const now = new Date().toISOString()
    const doc = {
      id,
      organizationId: orgId,
      scheduledDate: input.scheduledDate,
      status: input.status,
      categoryId: tmpl.categoryId,
      templateId: tmplDoc.id,
      postType:
        (tmpl.defaultPostType as string | undefined) ??
        (cat?.defaultPostType as string | undefined) ??
        "grid",
      priority: input.priority,
      brief: tmpl.name,
      blurb: input.blurb ?? (tmpl.blurbTemplate as string | undefined),
      hashtags,
      ctaId:
        (tmpl.defaultCtaId as string | undefined) ??
        (cat?.defaultCtaId as string | undefined),
      canvaUrl: tmpl.designTemplateCanvaUrl,
      assetUrls: [],
      channelStatuses: {},
      agentMeta: {
        sourceRunId: runId,
        sourceAgent: agentName,
        confidence: input.confidence,
        rationale: input.rationale,
        reviewState: input.reviewState,
        nextAction: {
          kind: input.nextActionKind,
          targetChannel: input.nextActionChannel,
          targetTime: input.nextActionTime,
          categoryId: tmpl.categoryId,
        },
      },
      createdAt: now,
      updatedAt: now,
    }
    await db.collection(orgPostsPath(orgId)).doc(id).set(doc)
    try {
      await embedIfChanged("post", orgId, id, doc as unknown as Record<string, unknown>)
    } catch {
      /* embedIfChanged soft-fails internally; never break the tool result */
    }
    return { ok: true, postId: id, templateId: tmplDoc.id }
  },
})
