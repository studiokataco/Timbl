import { z } from "zod"
import { LongRunningFunctionTool } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPostsPath } from "@/lib/firebase/paths"

import { getRuntimeCtx } from "../runtime/context"

/*
 * Human approval gate. When this tool is invoked, adk-js pauses the run
 * awaiting a tool result - that result is supplied later through the
 * /resume endpoint when the human clicks Approve or Reject in the UI.
 *
 * The tool's `execute` writes the pause into the post's agentMeta so the
 * UI can render an inline Approve/Reject action without having to read
 * the session event log to find a dangling tool call.
 */

const input = z.object({
  postId: z.string().min(1),
  summary: z.string().min(1).max(2_000),
})

export const requestHumanApprovalTool = new LongRunningFunctionTool({
  name: "requestHumanApproval",
  description:
    "Pause the run and request human approval of a draft post. Use this exactly once per draft, after the machine-review loop has converged. Returns nothing; the run resumes when the human acts.",
  parameters: input,
  execute: async (req, ctx) => {
    const { orgId, runId } = getRuntimeCtx(ctx)
    /* adk-js gives us the function-call id on Context.functionCallId - it
     * survives the pause/resume cycle and is the key the resume endpoint
     * uses when calling runner.submitToolResult(). */
    const toolCallId = ctx?.functionCallId ?? ""
    await getAdminDb()
      .collection(orgPostsPath(orgId))
      .doc(req.postId)
      .set(
        {
          "agentMeta.reviewState": "pending",
          "agentMeta.toolCallId": toolCallId,
          "agentMeta.sourceRunId": runId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )
    /* Returning nothing keeps the runner in `awaiting_human` - that's the
     * whole point of LongRunningFunctionTool. */
    return undefined
  },
})
