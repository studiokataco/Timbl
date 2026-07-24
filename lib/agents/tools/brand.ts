import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { readBrand, writeBrand } from "@/lib/brand/brand-store"
import { brandConfigPatchSchema } from "@/lib/schemas/brandConfig"

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
    const { orgId, brandId } = getRuntimeCtx(ctx)
    return { brandConfig: await readBrand(orgId, brandId ?? DEFAULT_BRAND_ID) }
  },
})

export const writeBrandConfigTool = new FunctionTool({
  name: "writeBrandConfig",
  description:
    "Persist a partial brand configuration. Provide only the fields you have new information for; existing fields are preserved. Returns the merged document.",
  parameters: writeInput,
  execute: async (input, ctx) => {
    const { orgId, brandId } = getRuntimeCtx(ctx)
    const brandConfig = await writeBrand(orgId, input, brandId ?? DEFAULT_BRAND_ID)
    return { ok: true, brandConfig }
  },
})
