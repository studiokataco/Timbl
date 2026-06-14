"use server"

import { z } from "zod"
import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getCurrentUser } from "@/lib/auth/server-helpers"
import {
  orgApprovalsLogPath,
  orgIdeationFeedPath,
  orgPostsPath,
} from "@/lib/firebase/paths"
import { gateErrorToResult, getOrgPlan, requireQuota } from "@/lib/plans/gate"
import { incrementUsage } from "@/lib/telemetry/agent-events"
import type {
  NextAction,
  NextActionKind,
  ServerActionResult,
} from "@/lib/schemas/_shared"

/*
 * Unified approval dispatcher.
 *
 * Every approvable artifact (post draft, ideation item) carries a
 * `nextAction` declaration that tells this action what to do on approval.
 * The resolver dispatches by `kind`, performs the side-effect (schedule,
 * promote, regenerate, etc.) and writes an entry to /approvalsLog so the
 * activity feed can show the full chain.
 *
 * `revertApproval` reads the log entry and reverses the side-effect; the
 * UI exposes this as a 5-second Undo on the approval toast.
 *
 * `approveAgentDraft` and `rejectAgentDraft` in agent-suggestions.ts now
 * delegate to this dispatcher; legacy callers continue to work because
 * an item without a `nextAction` is treated as `kind: 'noop'` (status
 * change only, the previous behavior).
 */

const approveItemInput = z.object({
  itemType: z.enum(["post", "ideation"]),
  itemId: z.string().min(1),
  /* Caller overrides for inline picker - channel/time chosen at click time. */
  override: z
    .object({
      targetChannel: z.string().optional(),
      targetTime: z.string().optional(),
      categoryId: z.string().optional(),
    })
    .optional(),
})
export type ApproveItemInput = z.infer<typeof approveItemInput>

export type ApproveItemResult = ServerActionResult & {
  artifactId?: string
  artifactType?: "post" | "ideation"
  nextActionKind?: NextActionKind
  approvalLogId?: string
  /* Carried through for run-resume when a paused human-gate is involved. */
  resumeRunId?: string
  resumeToolCallId?: string
}

export async function approveItem(input: unknown): Promise<ApproveItemResult> {
  const parsed = approveItemInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const user = await getCurrentUser()
  const db = getAdminDb()

  const { itemType, itemId, override } = parsed.data

  /* Load the source item + its declared next_action. */
  const sourceRef =
    itemType === "post"
      ? db.collection(orgPostsPath(orgId)).doc(itemId)
      : db.collection(orgIdeationFeedPath(orgId)).doc(itemId)
  const snap = await sourceRef.get()
  if (!snap.exists) return { ok: false, error: "not_found" }
  const data = snap.data() ?? {}
  if (data.organizationId !== orgId) return { ok: false, error: "cross_org" }

  const declared: NextAction | undefined =
    itemType === "post"
      ? (data.agentMeta?.nextAction as NextAction | undefined)
      : (data.nextAction as NextAction | undefined)

  const effective: NextAction = {
    kind: declared?.kind ?? "noop",
    payload: declared?.payload,
    targetChannel: override?.targetChannel ?? declared?.targetChannel,
    targetTime: (override?.targetTime as NextAction["targetTime"]) ?? declared?.targetTime,
    categoryId: override?.categoryId ?? declared?.categoryId,
    linkedArtifactId: declared?.linkedArtifactId,
  }

  /* Snapshot state before the resolver mutates anything; the log entry
   * needs `before` for revert to work. */
  const before: Record<string, unknown> = {
    status: data.status,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime,
    reviewState: data.agentMeta?.reviewState,
    ideationStatus: data.status,
  }

  let resolved: ResolverOutcome
  try {
    resolved = await runResolver({
      orgId,
      itemType,
      itemId,
      actorUserId: user.id,
      sourceData: data,
      nextAction: effective,
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "resolver_failed",
    }
  }
  if (!resolved.ok) return { ok: false, error: resolved.error }

  /* Write the approval log entry - single source of truth for activity
   * feed + revert. */
  const now = new Date().toISOString()
  const logId = randomUUID()
  await db
    .collection(orgApprovalsLogPath(orgId))
    .doc(logId)
    .set({
      id: logId,
      organizationId: orgId,
      action: "approve",
      itemType,
      itemId,
      nextActionKind: effective.kind,
      artifactId: resolved.artifactId ?? null,
      artifactType: resolved.artifactType ?? null,
      sourceAgent: data.agentMeta?.sourceAgent ?? null,
      sourceRunId: data.agentMeta?.sourceRunId ?? null,
      before,
      userId: user.id,
      createdAt: now,
    })

  return {
    ok: true,
    id: itemId,
    artifactId: resolved.artifactId,
    artifactType: resolved.artifactType,
    nextActionKind: effective.kind,
    approvalLogId: logId,
    resumeRunId: resolved.resumeRunId,
    resumeToolCallId: resolved.resumeToolCallId,
  }
}

/* ------------------------- Resolver core ------------------------- */

type ResolverInput = {
  orgId: string
  itemType: "post" | "ideation"
  itemId: string
  /* User clicking approve - used by multiStepApproval to track distinct
   * reviewers across multiple approval clicks. */
  actorUserId?: string
  sourceData: Record<string, unknown> & {
    agentMeta?: { sourceRunId?: string; toolCallId?: string }
  }
  nextAction: NextAction
}
type ResolverOutcome =
  | {
      ok: true
      artifactId?: string
      artifactType?: "post" | "ideation"
      resumeRunId?: string
      resumeToolCallId?: string
    }
  | { ok: false; error: string; gate?: ServerActionResult["gate"] }

async function runResolver(input: ResolverInput): Promise<ResolverOutcome> {
  switch (input.nextAction.kind) {
    case "schedule_post":
      return resolveSchedulePost(input)
    case "add_to_calendar":
      return resolveAddToCalendar(input)
    case "create_draft":
      return resolveCreateDraft(input)
    case "instantiate_template":
      return resolveInstantiateTemplate(input)
    case "assign_review":
      return resolveAssignReview(input)
    case "regenerate":
      return resolveRegenerate(input)
    case "noop":
      return resolveNoop(input)
    default:
      return { ok: false, error: `unknown_kind:${input.nextAction.kind}` }
  }
}

/* Marks the post as approved + sets it to a scheduled state with the
 * resolved date/time. Carries the resume identifiers so a paused agent
 * run keeps flowing. */
async function resolveSchedulePost(i: ResolverInput): Promise<ResolverOutcome> {
  if (i.itemType !== "post") return { ok: false, error: "schedule_post_requires_post" }
  const db = getAdminDb()
  const ref = db.collection(orgPostsPath(i.orgId)).doc(i.itemId)

  /* Only gate + meter the first time this post transitions to scheduled.
   * Re-approving an already-scheduled post shouldn't double-count. */
  const wasScheduled = i.sourceData.status === "scheduled"
  if (!wasScheduled) {
    try {
      await requireQuota(i.orgId, "scheduledPosts")
    } catch (err) {
      const gated = gateErrorToResult(err)
      if (gated) return gated
      throw err
    }
  }

  /* Multi-step approval gate. Plans with the `multiStepApproval` feature
   * require N distinct approvers before the post can flip to scheduled.
   * Plans without the feature treat first approval as final.
   *
   * Default required count is 2 when the plan has the feature; producers
   * can override via post.requiredApprovers (e.g. for high-risk
   * categories). The current approver's id is added to approvedBy; a
   * single user clicking approve twice never satisfies the requirement
   * because the set dedupes. */
  const plan = await getOrgPlan(i.orgId)
  const multiStepRequired =
    plan.features.multiStepApproval && !wasScheduled
  const required =
    (i.sourceData.requiredApprovers as number | undefined) ??
    (multiStepRequired ? 2 : 1)

  const prevApprovers = (i.sourceData.approvedBy as string[] | undefined) ?? []
  const approverSet = new Set<string>(prevApprovers)
  if (i.actorUserId) approverSet.add(i.actorUserId)
  const approvers = Array.from(approverSet)

  const enoughApprovers = approvers.length >= required
  const finalize = enoughApprovers || !multiStepRequired

  const time = resolveTargetTime(i.nextAction.targetTime)
  const patch: Record<string, unknown> = {
    approvedBy: approvers,
    requiredApprovers: required,
    updatedAt: new Date().toISOString(),
  }

  if (finalize) {
    patch["agentMeta.reviewState"] = "approved"
    patch.status = "scheduled"
    if (time.date) patch.scheduledDate = time.date
    if (time.time) patch.scheduledTime = time.time
    if (i.nextAction.targetChannel) {
      patch[`channelStatuses.${i.nextAction.targetChannel}`] = "scheduled"
    }
  } else {
    /* Partial approval - record reviewer count but keep status in review. */
    patch.status = "review"
  }

  await ref.set(patch, { merge: true })

  if (finalize && !wasScheduled) {
    try {
      await incrementUsage(i.orgId, "scheduledPosts")
    } catch (err) {
      console.warn(
        `[usage] scheduledPosts increment failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  return {
    ok: true,
    artifactId: i.itemId,
    artifactType: "post",
    resumeRunId: finalize ? i.sourceData.agentMeta?.sourceRunId : undefined,
    resumeToolCallId: finalize ? i.sourceData.agentMeta?.toolCallId : undefined,
  }
}

/* Just moves the post onto a date/time without flipping status. */
async function resolveAddToCalendar(i: ResolverInput): Promise<ResolverOutcome> {
  if (i.itemType !== "post") return { ok: false, error: "add_to_calendar_requires_post" }
  const db = getAdminDb()
  const ref = db.collection(orgPostsPath(i.orgId)).doc(i.itemId)
  const time = resolveTargetTime(i.nextAction.targetTime)
  const patch: Record<string, unknown> = {
    "agentMeta.reviewState": "approved",
    updatedAt: new Date().toISOString(),
  }
  if (time.date) patch.scheduledDate = time.date
  if (time.time) patch.scheduledTime = time.time
  await ref.set(patch, { merge: true })
  return {
    ok: true,
    artifactId: i.itemId,
    artifactType: "post",
    resumeRunId: i.sourceData.agentMeta?.sourceRunId,
    resumeToolCallId: i.sourceData.agentMeta?.toolCallId,
  }
}

/* Promotes an ideation item into a new post draft, transferring the
 * brief/summary as detailedBrief. */
async function resolveCreateDraft(i: ResolverInput): Promise<ResolverOutcome> {
  if (i.itemType !== "ideation") return { ok: false, error: "create_draft_requires_ideation" }
  const db = getAdminDb()
  const postId = randomUUID()
  const now = new Date().toISOString()
  const item = i.sourceData as {
    title?: string
    summary?: string
    suggestedDate?: string
    awarenessDayId?: string
    createdByRunId?: string
  }
  const time = resolveTargetTime(i.nextAction.targetTime)
  await db
    .collection(orgPostsPath(i.orgId))
    .doc(postId)
    .set({
      id: postId,
      organizationId: i.orgId,
      scheduledDate: time.date ?? item.suggestedDate ?? todayISO(),
      scheduledTime: time.time,
      status: "idea",
      categoryId: i.nextAction.categoryId,
      awarenessDayId: item.awarenessDayId,
      brief: item.title,
      detailedBrief: item.summary,
      hashtags: [],
      assetUrls: [],
      channelStatuses: i.nextAction.targetChannel
        ? { [i.nextAction.targetChannel]: "n/a" }
        : {},
      agentMeta: {
        sourceRunId: item.createdByRunId,
        sourceAgent: "ideator",
        ideationItemId: i.itemId,
        reviewState: "pending",
      },
      createdAt: now,
      updatedAt: now,
    })
  await db
    .collection(orgIdeationFeedPath(i.orgId))
    .doc(i.itemId)
    .set({ status: "used", promotedPostId: postId, updatedAt: now }, { merge: true })
  return { ok: true, artifactId: postId, artifactType: "post" }
}

async function resolveInstantiateTemplate(
  i: ResolverInput,
): Promise<ResolverOutcome> {
  /* Templates can be wired through the existing template-instantiation
   * action when that surface exists. Until then, treat as a draft creation
   * so approval still produces a visible artifact. */
  return resolveCreateDraft(i)
}

async function resolveAssignReview(i: ResolverInput): Promise<ResolverOutcome> {
  if (i.itemType !== "post") return { ok: false, error: "assign_review_requires_post" }
  const db = getAdminDb()
  const ref = db.collection(orgPostsPath(i.orgId)).doc(i.itemId)
  const assigneeId = (i.nextAction.payload?.assigneeId as string | undefined) ?? null
  await ref.set(
    {
      "agentMeta.reviewState": "pending",
      assigneeId: assigneeId ?? undefined,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return { ok: true, artifactId: i.itemId, artifactType: "post" }
}

async function resolveRegenerate(i: ResolverInput): Promise<ResolverOutcome> {
  /* Regenerate writes a "regenerate_requested" flag so a polling agent
   * pickup (or the existing agent runner) can start a new draft.
   * Intentionally a flag rather than a direct run trigger to avoid
   * coupling this layer to the agent runtime. */
  if (i.itemType !== "post") return { ok: false, error: "regenerate_requires_post" }
  const db = getAdminDb()
  const ref = db.collection(orgPostsPath(i.orgId)).doc(i.itemId)
  await ref.set(
    {
      "agentMeta.reviewState": "rejected",
      "agentMeta.regenerateRequested": true,
      "agentMeta.regenerateFeedback":
        (i.nextAction.payload?.feedback as string | undefined) ?? null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return { ok: true, artifactId: i.itemId, artifactType: "post" }
}

/* Legacy fallback for items without a declared next_action - just flips
 * the review state. Preserves today's behavior for any in-flight drafts. */
async function resolveNoop(i: ResolverInput): Promise<ResolverOutcome> {
  const db = getAdminDb()
  if (i.itemType === "post") {
    const ref = db.collection(orgPostsPath(i.orgId)).doc(i.itemId)
    await ref.set(
      {
        "agentMeta.reviewState": "approved",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
    return {
      ok: true,
      artifactId: i.itemId,
      artifactType: "post",
      resumeRunId: i.sourceData.agentMeta?.sourceRunId,
      resumeToolCallId: i.sourceData.agentMeta?.toolCallId,
    }
  }
  const ref = db.collection(orgIdeationFeedPath(i.orgId)).doc(i.itemId)
  await ref.set(
    { status: "used", updatedAt: new Date().toISOString() },
    { merge: true },
  )
  return { ok: true, artifactId: i.itemId, artifactType: "ideation" }
}

/* ------------------------- Revert ------------------------- */

const revertInput = z.object({ approvalLogId: z.string().min(1) })

export async function revertApproval(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = revertInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const db = getAdminDb()
  const logRef = db.collection(orgApprovalsLogPath(orgId)).doc(parsed.data.approvalLogId)
  const logSnap = await logRef.get()
  if (!logSnap.exists) return { ok: false, error: "log_not_found" }
  const log = logSnap.data() as {
    itemType: "post" | "ideation"
    itemId: string
    nextActionKind: NextActionKind
    artifactId?: string | null
    before?: Record<string, unknown>
  }

  /* Reverse the side-effect - best-effort, idempotent. */
  if (log.itemType === "post") {
    const ref = db.collection(orgPostsPath(orgId)).doc(log.itemId)
    const patch: Record<string, unknown> = {
      "agentMeta.reviewState": log.before?.reviewState ?? "pending",
      updatedAt: new Date().toISOString(),
    }
    if (log.before?.status !== undefined) patch.status = log.before.status
    if (log.before?.scheduledDate !== undefined) patch.scheduledDate = log.before.scheduledDate
    if (log.before?.scheduledTime !== undefined) patch.scheduledTime = log.before.scheduledTime
    await ref.set(patch, { merge: true })
  } else {
    /* Ideation revert: restore status, drop promotedPostId, optionally
     * delete the freshly created post. */
    const ref = db.collection(orgIdeationFeedPath(orgId)).doc(log.itemId)
    await ref.set(
      {
        status: log.before?.ideationStatus ?? "new",
        promotedPostId: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
    if (log.artifactId) {
      await db.collection(orgPostsPath(orgId)).doc(log.artifactId).delete().catch((err: unknown) => {
        console.error(`[approvals] revert: failed to delete artifact ${log.artifactId}`, err)
      })
    }
  }

  await logRef.set(
    { revertedAt: new Date().toISOString() },
    { merge: true },
  )
  return { ok: true, id: parsed.data.approvalLogId }
}

/* ------------------------- Bulk approve ------------------------- */

const bulkInput = z.object({
  items: z
    .array(
      z.object({
        itemType: z.enum(["post", "ideation"]),
        itemId: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
})

export type BulkApproveResult = ServerActionResult & {
  succeeded: number
  failed: number
  approvalLogIds: string[]
}

export async function bulkApproveItems(
  input: unknown,
): Promise<BulkApproveResult> {
  const parsed = bulkInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      succeeded: 0,
      failed: 0,
      approvalLogIds: [],
    }
  }
  /* All items must share a next_action.kind, enforced at the UI level via
   * a tooltip. The dispatcher per-item validation still protects us if a
   * caller bypasses that. */
  const ids: string[] = []
  let succeeded = 0
  let failed = 0
  for (const item of parsed.data.items) {
    const r = await approveItem(item)
    if (r.ok) {
      succeeded += 1
      if (r.approvalLogId) ids.push(r.approvalLogId)
    } else {
      failed += 1
    }
  }
  return {
    ok: failed === 0,
    succeeded,
    failed,
    approvalLogIds: ids,
  }
}

/* ------------------------- Helpers ------------------------- */

function resolveTargetTime(
  target: NextAction["targetTime"],
): { date?: string; time?: string } {
  if (!target) return {}
  if (target === "auto") {
    /* Cadence-based auto-slotting will plug in here once category cadence
     * rules are queryable; for now return empty so the human picker is
     * prompted at the UI layer. */
    return {}
  }
  /* target is an ISO timestamp. */
  const d = new Date(target)
  if (Number.isNaN(d.getTime())) return {}
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ------------------------- Activity feed query ------------------------- */

/* Row shape returned to the UI. Stable across schema changes - the doc
 * stores extra forensic fields (`before` snapshot for revert) that the
 * activity panel doesn't need to render. */
export type ApprovalLogRow = {
  id: string
  action: "approve"
  itemType: "post" | "ideation"
  itemId: string
  nextActionKind: NextActionKind
  artifactId: string | null
  artifactType: "post" | "ideation" | null
  sourceAgent: string | null
  sourceRunId: string | null
  userId: string
  createdAt: string
  revertedAt: string | null
}

const listInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
})

export async function listApprovalsLog(
  input: unknown = {},
): Promise<ApprovalLogRow[]> {
  const parsed = listInput.parse(input ?? {})
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb()
    .collection(orgApprovalsLogPath(orgId))
    .orderBy("createdAt", "desc")
    .limit(parsed.limit)
    .get()
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      action: "approve" as const,
      itemType: data.itemType as "post" | "ideation",
      itemId: data.itemId as string,
      nextActionKind: data.nextActionKind as NextActionKind,
      artifactId: (data.artifactId as string | null) ?? null,
      artifactType: (data.artifactType as "post" | "ideation" | null) ?? null,
      sourceAgent: (data.sourceAgent as string | null) ?? null,
      sourceRunId: (data.sourceRunId as string | null) ?? null,
      userId: data.userId as string,
      createdAt: data.createdAt as string,
      revertedAt: (data.revertedAt as string | null) ?? null,
    }
  })
}

/* nextActionKind enum stays in lib/schemas/_shared.ts - re-exporting a
 * Zod object from a "use server" file trips Next's invalid-use-server-value
 * check. Callers import it directly from @/lib/schemas. */
