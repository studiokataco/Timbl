import { z } from "zod"
import { FunctionTool } from "@google/adk"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgAgentConfigsPath,
  orgPath,
} from "@/lib/firebase/paths"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Meta-config tools - read agent configurations and *propose* changes for
 * a human to review. Direct edits go through /settings/agents; agents
 * never silently rewrite their own (or another agent's) prompt. Proposals
 * land in /organizations/{orgId}/agentConfigProposals/{id}.
 */

const readInput = z.object({
  name: z.string().min(1),
})

export const readAgentConfigTool = new FunctionTool({
  name: "readAgentConfig",
  description:
    "Read another agent's configuration (provider, model, prompt, budgets). Useful for the meta-config agent.",
  parameters: readInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const snap = await getAdminDb()
      .collection(orgAgentConfigsPath(orgId))
      .doc(input.name)
      .get()
    if (!snap.exists) return { ok: false, error: "not_found" }
    return { ok: true, config: snap.data() }
  },
})

const proposeInput = z.object({
  name: z.string().min(1),
  patch: z.record(z.string(), z.unknown()),
  rationale: z.string().min(1).max(4_000),
})

export const proposeAgentConfigChangeTool = new FunctionTool({
  name: "proposeAgentConfigChange",
  description:
    "Propose a partial update to another agent's configuration. The patch is queued for human approval, NOT applied immediately. Always include a `rationale` so the reviewer can decide.",
  parameters: proposeInput,
  execute: async (input, ctx) => {
    const { orgId, runId, agentName, userId } = getRuntimeCtx(ctx)
    const id = randomUUID()
    const now = new Date().toISOString()
    await getAdminDb()
      .doc(`${orgPath(orgId)}/agentConfigProposals/${id}`)
      .set({
        id,
        organizationId: orgId,
        targetAgent: input.name,
        patch: input.patch,
        rationale: input.rationale,
        proposedByAgent: agentName,
        proposedByUserId: userId,
        sourceRunId: runId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
    return { ok: true, proposalId: id }
  },
})
