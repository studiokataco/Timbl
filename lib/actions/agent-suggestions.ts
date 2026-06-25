"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { orgPostsPath } from "@/lib/firebase/paths"
import { getAgentSession } from "@/lib/actions/agent-sessions"
import { approveItem } from "@/lib/actions/approvals"
import {
  REJECT_REASONS,
  REJECT_REASON_LABELS,
  type RejectReason,
} from "@/lib/schemas/_shared"
import type { ServerActionResult } from "@/lib/schemas"

/* Local extension: approve/reject return a resumeRunId + resumeToolCallId
 * when the post's review pause needs the run resumed via the SSE endpoint
 * /api/agents/runs/{runId}/resume. The UI consumes these to stream the
 * continuation if the user wants to watch it. The approval-log id is
 * surfaced so the UI can offer Undo. */
type AgentDraftReviewResult = ServerActionResult & {
  resumeRunId?: string
  resumeToolCallId?: string
  approvalLogId?: string
  nextActionKind?: string
}

async function patchAgentMeta(
  orgId: string,
  postId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true; sourceRunId?: string; toolCallId?: string } | { ok: false; error: string }> {
  const ref = getAdminDb().collection(orgPostsPath(orgId)).doc(postId)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "post_not_found" }
  const data = snap.data()
  if (data?.organizationId !== orgId) return { ok: false, error: "cross_org" }
  const meta = (data.agentMeta ?? {}) as Record<string, unknown>
  /* Nested object, not "agentMeta.key" strings: set(merge) writes a dotted
   * string as a literal flat field, never reaching the agentMeta map. */
  const flat: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    agentMeta: { ...patch },
  }
  await ref.set(flat, { merge: true })
  return {
    ok: true,
    sourceRunId: meta.sourceRunId as string | undefined,
    toolCallId: meta.toolCallId as string | undefined,
  }
}

const approveInput = z.object({
  postId: z.string().min(1),
  /* Caller can override channel/time at click-time via the inline picker. */
  override: z
    .object({
      targetChannel: z.string().optional(),
      targetTime: z.string().optional(),
      categoryId: z.string().optional(),
    })
    .optional(),
})

export async function approveAgentDraft(
  input: unknown,
): Promise<AgentDraftReviewResult> {
  const parsed = approveInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  /* Delegate to the unified dispatcher. Posts without a declared next_action
   * resolve as 'noop' (legacy: status flip only) so callers built before the
   * dispatcher existed keep working unchanged. */
  const result = await approveItem({
    itemType: "post",
    itemId: parsed.data.postId,
    override: parsed.data.override,
  })
  if (!result.ok) return { ok: false, error: result.error }
  return {
    ok: true,
    id: parsed.data.postId,
    resumeRunId: result.resumeRunId,
    resumeToolCallId: result.resumeToolCallId,
    approvalLogId: result.approvalLogId,
    nextActionKind: result.nextActionKind,
  }
}

/* ---------------- Human-gate resolution (Phase D) ----------------
 *
 * The Studio surfaces awaiting_human runs as approval cards. Those cards
 * need to act on the run identity (the `runId` is what's in the URL /
 * activity stream), not the postId - the postId is buried in the
 * requestHumanApproval tool_call args. This action looks up the latest
 * such tool_call from the session event log and dispatches to the
 * existing approveAgentDraft / rejectAgentDraft writers so post state +
 * the resume pipeline stay consistent. */

const resolveHumanGateInput = z.object({
  runId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(4_000).optional(),
})

export type ResolveHumanGateResult = AgentDraftReviewResult & {
  postId?: string
}

export async function resolveHumanGate(
  input: unknown,
): Promise<ResolveHumanGateResult> {
  const parsed = resolveHumanGateInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const session = await getAgentSession({ runId: parsed.data.runId, limit: 1_000 })
  if (!session.sessionId) {
    return { ok: false, error: "session_not_found" }
  }
  /* Walk newest-first to find the most recent requestHumanApproval call. */
  let postId: string | undefined
  for (let i = session.events.length - 1; i >= 0; i--) {
    const ev = session.events[i].event
    if (ev.type !== "tool_call") continue
    const call = ev.call as { name?: string; args?: unknown } | undefined
    if (!call || call.name !== "requestHumanApproval") continue
    const args = (call.args ?? {}) as { postId?: string }
    if (args.postId) {
      postId = args.postId
      break
    }
  }
  if (!postId) {
    return { ok: false, error: "no_pending_approval" }
  }
  if (parsed.data.decision === "approve") {
    const r = await approveAgentDraft({ postId })
    if (r.ok) return { ...r, postId }
    return r
  }
  const r = await rejectAgentDraft({ postId, reason: parsed.data.comment })
  if (r.ok) return { ...r, postId }
  return r
}

/* Rejection input. `REJECT_REASONS` / `REJECT_REASON_LABELS` /
 * `RejectReason` now live in lib/schemas/_shared.ts - a "use server" file
 * may only export async functions. `regenerate` toggles the regenerate
 * flow: sets a flag on the post that downstream agent runs pick up to
 * produce a new draft incorporating the feedback. */
const rejectInput = z.object({
  postId: z.string().min(1),
  reason: z.enum(REJECT_REASONS).optional(),
  reasonNote: z.string().max(2_000).optional(),
  regenerate: z.boolean().optional(),
})

export async function rejectAgentDraft(
  input: unknown,
): Promise<AgentDraftReviewResult> {
  const parsed = rejectInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const composed = composeRationale(parsed.data.reason, parsed.data.reasonNote)
  const patch: Record<string, unknown> = { reviewState: "rejected" }
  if (composed) patch.rationale = composed
  if (parsed.data.regenerate) {
    patch.regenerateRequested = true
    patch.regenerateFeedback = composed ?? null
  }
  const result = await patchAgentMeta(orgId, parsed.data.postId, patch)
  if (!result.ok) return { ok: false, error: result.error }
  return {
    ok: true,
    id: parsed.data.postId,
    resumeRunId: result.sourceRunId,
    resumeToolCallId: result.toolCallId,
  }
}

function composeRationale(
  reason: RejectReason | undefined,
  note: string | undefined,
): string | undefined {
  const parts: string[] = []
  if (reason && reason !== "other") parts.push(REJECT_REASON_LABELS[reason])
  if (note) parts.push(note)
  return parts.length > 0 ? parts.join(" - ") : undefined
}
