import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgBrandConfigDocPath } from "@/lib/firebase/paths"
import {
  brandConfigSchema,
  brandConfigPatchSchema,
} from "@/lib/schemas/brandConfig"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Brand-config tools - read + write the same Firestore doc the UI uses
 * (via lib/actions/brand-config.ts). Tools intentionally bypass the
 * server-action layer because they execute inside the agent runtime, which
 * already runs server-side and already has resolved orgId from the session
 * state. Going through "use server" actions would introduce a needless
 * RPC round-trip and lose the org-scoping context.
 */

const writeInput = brandConfigPatchSchema

export const readBrandConfigTool = new FunctionTool({
  name: "readBrandConfig",
  description:
    "Read the organisation's current brand configuration. Returns `null` if the brand has not yet been set up.",
  parameters: z.object({}),
  execute: async (_input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const snap = await getAdminDb().doc(orgBrandConfigDocPath(orgId)).get()
    if (!snap.exists) return { brandConfig: null }
    const parsed = brandConfigSchema.safeParse({
      ...(snap.data() ?? {}),
      id: "default",
      organizationId: orgId,
    })
    return { brandConfig: parsed.success ? parsed.data : null }
  },
})

export const writeBrandConfigTool = new FunctionTool({
  name: "writeBrandConfig",
  description:
    "Persist a partial brand configuration. Provide only the fields you have new information for; existing fields are preserved. Returns the merged document.",
  parameters: writeInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const ref = getAdminDb().doc(orgBrandConfigDocPath(orgId))
    const now = new Date().toISOString()
    await ref.set(
      {
        id: "default",
        organizationId: orgId,
        ...input,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true },
    )
    const snap = await ref.get()
    return {
      ok: true,
      brandConfig: { ...(snap.data() ?? {}), id: "default", organizationId: orgId },
    }
  },
})
