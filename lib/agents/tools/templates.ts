import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { embedIfChanged } from "@/lib/embeddings/embeddable"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgCategoriesPath, orgTemplatesPath } from "@/lib/firebase/paths"
import { postType } from "@/lib/schemas/_shared"
import { templateCadence } from "@/lib/schemas/template"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Library-template tool. Mirrors lib/actions/templates.ts (the UI path) but
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
    "Create a reusable library template for recurring posts (eg. work anniversaries, monthly recaps). Use [PLACEHOLDER] tokens in blurbTemplate for the parts that change each time. Always include a name and a blurbTemplate.",
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
