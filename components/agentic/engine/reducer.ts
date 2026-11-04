import { REJECT_REASON_LABELS } from "@/lib/schemas/_shared"
import { FIXTURE_NOW_MS, addDays, daysUntil, formatDay, formatDayShort, formatWhen, mondayOf, nowMs } from "../clock"
import { makeCopy, type Copy } from "../copy"
import {
  ACTIVITY_SEED,
  APPROVE_DECK,
  BRAND_CADENCE,
  CAMPAIGNS,
  DEFAULT_BRIEF,
  DEFAULT_SCHEDULE,
  NOTES,
  POSTS,
  READS,
  REACTION_NAMES,
  REFINE_VARIANTS,
  RUN_TEMPLATES,
  SUBMISSIONS,
  TEAM,
  USAGE_LIMIT,
  VOICE_SCRIPTS,
} from "../defaults"
import { STEP_MS, extractMentions, unreadFor } from "../lib"
import type {
  ActivityEntry,
  ApprovalQueueItem,
  ApprovalSubmission,
  CanvasCard,
  CardAction,
  CardStatus,
  EngineEffect,
  EngineEnv,
  EngineEvent,
  EngineState,
  GlanceCard,
  GuardrailAction,
  GuardrailRequest,
  NoteSystemEvent,
  PrototypeNote,
  PrototypePost,
  RefineKind,
  Run,
  RunKind,
  Scene,
  StateChipState,
  TeamMember,
  TranscriptAttachment,
  TranscriptEntry,
  UsageChoice,
  UserRole,
  VoiceScriptId,
  WeekId,
} from "../types"
import { routeIntent, type Intent } from "./router"

export type EngineInput = EngineEvent & { env: EngineEnv }
export type QueueEntry = { item: ApprovalQueueItem; needsViewer: boolean }
export type RailData = {
  stats: { scheduled: number; review: number; slots: number; campaigns: number }
  attention: { postId: string; title: string; source: ApprovalQueueItem["source"] | "mention"; unread: { count: number; mentions: number } }[]
  comingUp: { postId: string; title: string; when: string }[]
}
type Viewer = Pick<TeamMember, "id" | "role">

const MINI_INITIAL_ID = "mini-initial"
const DESIGNER_ID = "u-designer"
const TEAMMATE_NOTE = "Pushed a new crop for slide 3."
const RESCHEDULE_TARGET = { postId: "p-thu", date: "2026-11-06", time: "12:30" } as const
const USAGE_USED: Record<UsageChoice, number> = { ok: 3, near: 18, cap: USAGE_LIMIT }
const OFFSET_MS = 330 * 60_000
const DAY_MS = 86_400_000

const copyCache = new Map<string, Copy>()
function copyFor(name: string): Copy {
  const hit = copyCache.get(name)
  if (hit) return hit
  const built = makeCopy(name)
  copyCache.set(name, built)
  return built
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function civil(days: number): { y: number; m: number; d: number } {
  const z = days + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d }
}

function isoAt(ms: number): string {
  const local = ms + OFFSET_MS
  const days = Math.floor(local / DAY_MS)
  const rem = local - days * DAY_MS
  const { y, m, d } = civil(days)
  const hh = Math.floor(rem / 3_600_000)
  const mm = Math.floor((rem % 3_600_000) / 60_000)
  const ss = Math.floor((rem % 60_000) / 1000)
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}+05:30`
}

type Ctx = {
  env: EngineEnv
  copy: Copy
  viewer: Viewer
  seq: number
  now: number
  at: string
  counters: Record<string, number>
}

function nextId(ctx: Ctx, prefix: "m" | "act" | "note" | "req" | "run"): string {
  const count = (ctx.counters[prefix] ?? 0) + 1
  ctx.counters[prefix] = count
  return count === 1 ? `${prefix}-${ctx.seq}` : `${prefix}-${ctx.seq}-${count}`
}

function memberName(id: string): string {
  return TEAM.find((m) => m.id === id)?.name ?? id
}

function isApproverRole(role: UserRole): boolean {
  return role === "admin" || role === "editor"
}

function initialMini(copy: Copy): TranscriptEntry {
  return { id: MINI_INITIAL_ID, role: "assistant", text: copy.flyout.initial, createdAt: FIXTURE_NOW_MS }
}

export function initialEngineState(env: EngineEnv): EngineState {
  const copy = copyFor(env.assistantName)
  return {
    seq: 0,
    clock: nowMs(),
    transcript: [{ id: "m-intro", role: "assistant", text: copy.reply.intro, createdAt: nowMs() }],
    miniChat: [initialMini(copy)],
    queue: [],
    canvas: { card: null, status: "ready", visibility: "shown" },
    run: null,
    runs: [],
    failNext: false,
    requests: [],
    posts: { ...POSTS },
    drafts: { visible: false, approved: [], submitted: [] },
    deck: { order: APPROVE_DECK.map((entry) => entry.postId), index: 0, decisions: [], refining: null },
    notes: [...NOTES],
    reads: [...READS],
    submissions: [...SUBMISSIONS],
    activity: [...ACTIVITY_SEED],
    ideaSet: "first",
    chosenIdeaId: null,
    ideas: {},
    glance: { reconnectDays: null, events: [] },
    brief: { ...DEFAULT_BRIEF },
    schedule: DEFAULT_SCHEDULE.map((slot) => ({ ...slot })),
    staged: [],
    context: { kind: "calendar", week: "2026-11-02" },
    usage: { used: USAGE_USED.ok, limit: USAGE_LIMIT },
    composerDraft: "",
    pendingOffer: null,
    lastEventKind: null,
    effects: [],
  }
}

function effect(s: EngineState, e: EngineEffect): EngineState {
  return { ...s, effects: [...s.effects, e] }
}

function cardLink(card: CanvasCard): TranscriptAttachment {
  return { kind: "card_link", card }
}

function say(s: EngineState, ctx: Ctx, text: string, attachments?: TranscriptAttachment[]): EngineState {
  const entry: TranscriptEntry = { id: nextId(ctx, "m"), role: "assistant", text, createdAt: ctx.now, ...(attachments?.length ? { attachments } : {}) }
  return { ...s, transcript: [...s.transcript, entry] }
}

function userLine(
  s: EngineState,
  ctx: Ctx,
  text: string,
  extra: Pick<TranscriptEntry, "source" | "attachments" | "queued"> = {},
): EngineState {
  const entry: TranscriptEntry = { id: nextId(ctx, "m"), role: "user", text, createdAt: ctx.now, ...extra }
  return { ...s, transcript: [...s.transcript, entry] }
}

function attachToLastUser(s: EngineState, attachment: TranscriptAttachment): EngineState {
  const index = s.transcript.map((e) => e.role).lastIndexOf("user")
  if (index < 0) return s
  const transcript = s.transcript.map((e, i) => (i === index ? { ...e, attachments: [...(e.attachments ?? []), attachment] } : e))
  return { ...s, transcript }
}

function log(s: EngineState, ctx: Ctx, entry: Omit<ActivityEntry, "id" | "at" | "actor"> & { actor?: ActivityEntry["actor"] }): EngineState {
  const full: ActivityEntry = { id: nextId(ctx, "act"), at: ctx.at, actor: entry.actor ?? { kind: "user", userId: ctx.viewer.id }, ...entry }
  return { ...s, activity: [full, ...s.activity] }
}

function showCard(s: EngineState, card: CanvasCard, status: CardStatus): EngineState {
  return effect({ ...s, canvas: { card, status, visibility: "shown" } }, { type: "canvas_shown" })
}

function setCanvasStatus(s: EngineState, status: CardStatus): EngineState {
  return { ...s, canvas: { ...s.canvas, status } }
}

function setRun(s: EngineState, run: Run): EngineState {
  const exists = s.runs.some((r) => r.id === run.id)
  return { ...s, run, runs: exists ? s.runs.map((r) => (r.id === run.id ? run : r)) : [...s.runs, run] }
}

function patchPost(s: EngineState, postId: string, patch: Partial<PrototypePost>): EngineState {
  const post = s.posts[postId]
  if (!post) return s
  return { ...s, posts: { ...s.posts, [postId]: { ...post, ...patch } } }
}

function setReviewState(s: EngineState, postId: string, reviewState: "pending" | "approved"): EngineState {
  const post = s.posts[postId]
  if (!post?.agentMeta) return s
  return patchPost(s, postId, { agentMeta: { ...post.agentMeta, reviewState } })
}

function postTitle(s: EngineState, postId: string): string {
  return s.posts[postId]?.brief ?? postId
}

function addNote(
  s: EngineState,
  ctx: Ctx,
  note: { postId: string; authorId: string; body: string; kind?: "note" | "system"; system?: NoteSystemEvent; annotations?: PrototypeNote["annotations"]; mentionUserIds?: string[] },
): EngineState {
  const full: PrototypeNote = {
    id: nextId(ctx, "note"),
    postId: note.postId,
    authorId: note.authorId,
    body: note.body,
    isInternal: true,
    createdAt: ctx.at,
    updatedAt: ctx.at,
    kind: note.kind ?? "note",
    annotations: note.annotations ?? [],
    mentionUserIds: note.mentionUserIds ?? [],
    mentions: note.mentionUserIds ?? [],
    reactions: [],
    ...(note.system ? { system: note.system } : {}),
  }
  return { ...s, notes: [...s.notes, full] }
}

function systemNote(s: EngineState, ctx: Ctx, postId: string, event: NoteSystemEvent["event"], actorId: string, body: string, extra: Partial<NoteSystemEvent> = {}): EngineState {
  return addNote(s, ctx, { postId, authorId: actorId, body, kind: "system", system: { event, actorId, ...extra } })
}

function draftPostIds(s: EngineState): string[] {
  return Object.values(s.posts)
    .filter((p) => p.status !== "archived" && p.status !== "posted")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id))
    .map((p) => p.id)
}

function ideaList(s: EngineState, set: "first" | "more"): string[] {
  const ids = Object.keys(s.ideas)
  return set === "more" ? ids.slice(3, 6) : ids.slice(0, 3)
}

function lastUserText(s: EngineState): string {
  return [...s.transcript].reverse().find((entry) => entry.role === "user")?.text ?? ""
}

function matchPosts(s: EngineState, text: string): PrototypePost[] {
  const t = text.toLowerCase()
  const all = Object.values(s.posts).filter((p) => p.status !== "archived")
  const typeMatch = (["reel", "carousel", "story", "grid", "video"] as const).find((key) => t.includes(key))
  return typeMatch ? all.filter((p) => p.postType === typeMatch) : all
}

function activeDraftId(s: EngineState): string | null {
  const ids = draftPostIds(s)
  return s.canvas.card?.kind === "drafts" ? (ids[s.canvas.card.activeIndex] ?? ids[0] ?? null) : ids[0] ?? null
}

function contextPostId(s: EngineState): string | null {
  if (s.context.kind === "post") return s.context.postId
  if (s.canvas.card?.kind === "current_item") return s.canvas.card.postId
  return null
}

function weekOf(date: string): WeekId {
  return mondayOf(date || "")
}

function openSubmission(s: EngineState, postId: string): ApprovalSubmission | undefined {
  return s.submissions.find((sub) => sub.postId === postId && !sub.decision)
}

function latestSubmission(s: EngineState, postId: string): ApprovalSubmission | undefined {
  const all = s.submissions.filter((sub) => sub.postId === postId)
  return all[all.length - 1]
}

function replaceSubmission(s: EngineState, target: ApprovalSubmission, next: ApprovalSubmission | null): EngineState {
  const submissions = next ? s.submissions.map((sub) => (sub === target ? next : sub)) : s.submissions.filter((sub) => sub !== target)
  return { ...s, submissions }
}

function applyCaption(s: EngineState, ctx: Ctx, postId: string, blurb: string, actorId: string, extra: Partial<PrototypePost> = {}): EngineState {
  const post = s.posts[postId]
  if (!post) return s
  const oldRev = post.contentRev
  const newRev = oldRev + 1
  let next = patchPost(s, postId, { ...extra, blurb, contentRev: newRev })
  const sub = latestSubmission(next, postId)
  const hadApproval = !!sub && (sub.decision?.outcome === "approved" || sub.approvals.some((a) => a.rev === oldRev))
  if (sub && hadApproval) {
    const { decision, ...rest } = sub
    const kept: ApprovalSubmission = decision && decision.outcome !== "approved" ? { ...rest, decision, contentRev: newRev } : { ...rest, contentRev: newRev }
    next = replaceSubmission(next, sub, kept)
    next = patchPost(next, postId, { status: "needs_approval" })
    next = systemNote(next, ctx, postId, "edited_after_approval", actorId, ctx.copy.notes.system.stale(memberName(actorId)))
    next = log(next, ctx, { kind: "stale", postId, actor: { kind: "user", userId: actorId } })
  }
  if (next.drafts.approved.includes(postId)) {
    next = { ...next, drafts: { ...next.drafts, approved: next.drafts.approved.filter((id) => id !== postId) } }
    next = setReviewState(next, postId, "pending")
    next = log(next, ctx, { kind: "stale", postId, actor: { kind: "user", userId: actorId } })
  }
  return next
}

function startRun(s: EngineState, ctx: Ctx, kind: RunKind, id: string): EngineState {
  const template = RUN_TEMPLATES[kind]
  const run: Run = {
    id,
    kind,
    title: template.title,
    status: "running",
    startedAt: ctx.now,
    steps: template.steps.map((step, i) => (i === 0 ? { ...step, state: "running", startedAt: ctx.now } : { ...step, state: "pending" })),
  }
  return effect(setRun(s, run), { type: "tick", delayMs: STEP_MS[ctx.env.speed] })
}

function proposeRun(s: EngineState, ctx: Ctx, kind: RunKind): { state: EngineState; runId: string } {
  const template = RUN_TEMPLATES[kind]
  const runId = nextId(ctx, "run")
  const run: Run = { id: runId, kind, title: template.title, status: "proposed", steps: template.steps.map((step) => ({ ...step, state: "pending" })) }
  return { state: setRun(s, run), runId }
}

function approveDraftState(s: EngineState, ctx: Ctx, postId: string): EngineState {
  if (s.drafts.approved.includes(postId)) return s
  let next: EngineState = { ...s, drafts: { ...s.drafts, approved: [...s.drafts.approved, postId] } }
  next = setReviewState(next, postId, "approved")
  return log(next, ctx, { kind: "approved", postId })
}

function submitPost(s: EngineState, ctx: Ctx, postId: string): EngineState {
  const post = s.posts[postId]
  if (!post) return s
  let next: EngineState = s
  if (draftPostIds(s).includes(postId) && !next.drafts.submitted.includes(postId)) {
    next = { ...next, drafts: { ...next.drafts, submitted: [...next.drafts.submitted, postId] } }
  }
  next = patchPost(next, postId, { status: "needs_approval" })
  if (!openSubmission(next, postId)) {
    const sub: ApprovalSubmission = { postId, submittedBy: ctx.viewer.id, submittedAt: ctx.at, contentRev: post.contentRev, requiredApprovers: 1, approvals: [] }
    next = { ...next, submissions: [...next.submissions, sub] }
    next = systemNote(next, ctx, postId, "submitted", ctx.viewer.id, ctx.copy.notes.system.submitted(memberName(ctx.viewer.id)))
  }
  return log(next, ctx, { kind: "submitted", postId })
}

function allDraftsApproved(s: EngineState): boolean {
  const ids = draftPostIds(s)
  return ids.length > 0 && ids.every((id) => s.drafts.approved.includes(id))
}

function upsertRequest(s: EngineState, ctx: Ctx, action: GuardrailAction, postIds: string[], when?: string): { state: EngineState; requestId: string } {
  const key = [...postIds].sort().join(",")
  const existing = s.requests.find((r) => r.status === "pending" && r.action === action && [...r.postIds].sort().join(",") === key)
  if (existing) return { state: s, requestId: existing.id }
  const request: GuardrailRequest = { id: nextId(ctx, "req"), action, postIds, status: "pending", requestedAt: ctx.at, ...(when ? { when } : {}) }
  return { state: { ...s, requests: [...s.requests, request] }, requestId: request.id }
}

function verbFor(copy: Copy, request: GuardrailRequest): string {
  const n = request.postIds.length
  switch (request.action) {
    case "schedule":
      return copy.approval.verbs.schedule(n)
    case "reschedule":
      return copy.approval.verbs.reschedule(request.when ?? "")
    case "publish":
      return copy.approval.verbs.publish(n)
    case "delete":
      return copy.approval.verbs.delete(n)
    case "bulk_approve":
      return copy.approval.verbs.bulk_approve(n)
  }
}

function directionsCard(s: EngineState, set: "first" | "more"): Extract<CanvasCard, { kind: "directions" }> {
  const ids = ideaList(s, set)
  const selectedId = s.chosenIdeaId && ids.includes(s.chosenIdeaId) ? s.chosenIdeaId : (ids[0] ?? "")
  return { kind: "directions", set, selectedId }
}

function briefName(s: EngineState, ideaId: string): string {
  return (s.ideas[ideaId]?.title ?? "").replace(/\.$/, "")
}

function queueStatus(s: EngineState, ctx: Ctx): CardStatus {
  return deriveQueue(s, ctx.viewer).some((entry) => entry.needsViewer) ? "needs_you" : "ready"
}

function routerContext(s: EngineState) {
  return {
    card: s.canvas.card,
    hasBrief: s.chosenIdeaId !== null,
    hasDrafts: s.drafts.visible,
    contextPostId: s.context.kind === "post" ? s.context.postId : null,
    pendingOffer: s.pendingOffer,
  }
}

function intentIdeas(s: EngineState, ctx: Ctx): EngineState {
  const card = directionsCard(s, "first")
  return showCard(say({ ...s, ideaSet: "first" }, ctx, ctx.copy.reply.ideas, [cardLink(card)]), card, "ready")
}

function intentMoreIdeas(s: EngineState, ctx: Ctx): EngineState {
  const card: CanvasCard = { kind: "directions", set: "more", selectedId: "idea-4" }
  return showCard(say({ ...s, ideaSet: "more" }, ctx, ctx.copy.reply.moreIdeas, [cardLink(card)]), card, "ready")
}

function intentCompare(s: EngineState, ctx: Ctx): EngineState {
  const current = s.canvas.card?.kind === "directions" ? s.canvas.card : directionsCard(s, s.ideaSet)
  const ids = ideaList(s, current.set)
  if (ids.length < 2) return say(s, ctx, ctx.copy.reply.fallback)
  const ideaId = current.selectedId || ids[0]
  const alternateId = ids[(ids.indexOf(ideaId) + 1) % ids.length]
  const card: CanvasCard = { kind: "recommendation", ideaId, alternateId }
  const text = ctx.copy.reply.debate(s.ideas[ideaId]?.title ?? "", s.ideas[alternateId]?.title ?? "")
  return showCard(say(s, ctx, text, [cardLink(card)]), card, "ready")
}

function intentPlan(s: EngineState, ctx: Ctx, needsDrafts: boolean): EngineState {
  const { state, runId } = proposeRun(s, ctx, "plan_to_drafts")
  const text = needsDrafts ? ctx.copy.reply.scheduleNeedsDrafts : ctx.copy.reply.planProposed
  return say(state, ctx, text, [{ kind: "plan", runId }])
}

function intentCreate(s: EngineState, ctx: Ctx, fromCard: boolean): EngineState {
  if (!s.brief.campaignName.trim()) return s
  const runId = nextId(ctx, "run")
  const attachment: TranscriptAttachment = { kind: "plan", runId }
  let next = fromCard ? userLine(s, ctx, ctx.copy.reply.createUser, { attachments: [attachment] }) : attachToLastUser(s, attachment)
  next = showCard(next, { kind: "drafts", activeIndex: 0 }, "streaming")
  return startRun(next, ctx, "create_drafts", runId)
}

function intentDrafts(s: EngineState, ctx: Ctx): EngineState {
  const card: CanvasCard = { kind: "drafts", activeIndex: s.canvas.card?.kind === "drafts" ? s.canvas.card.activeIndex : 0 }
  return showCard(say(s, ctx, ctx.copy.reply.created, [cardLink(card)]), card, allDraftsApproved(s) ? "done" : "needs_you")
}

function tightenBlurb(blurb: string): string {
  const cut = blurb.indexOf(". ")
  return cut < 0 ? blurb : blurb.slice(0, cut + 1)
}

function intentTighten(s: EngineState, ctx: Ctx, postId: string | null): EngineState {
  const target = postId ?? activeDraftId(s)
  const post = target ? s.posts[target] : undefined
  const next = post && target ? applyCaption(s, ctx, target, tightenBlurb(post.blurb ?? ""), ctx.viewer.id) : s
  return say(next, ctx, ctx.copy.reply.tightened)
}

function pendingScheduleRequest(s: EngineState): GuardrailRequest | undefined {
  return [...s.requests].reverse().find((r) => r.action === "schedule" && r.status === "pending")
}

function intentSchedule(s: EngineState, ctx: Ctx): EngineState {
  if (!s.drafts.visible) return intentPlan(s, ctx, true)
  const pending = pendingScheduleRequest(s)
  const card: CanvasCard = pending ? { kind: "schedule", requestId: pending.id } : { kind: "schedule" }
  return showCard(say({ ...s, pendingOffer: null }, ctx, ctx.copy.reply.schedule, [cardLink(card)]), card, pending ? "needs_you" : "ready")
}

function intentApprovals(s: EngineState, ctx: Ctx): EngineState {
  const card: CanvasCard = { kind: "approvals_queue" }
  return showCard(say(s, ctx, ctx.copy.reply.approvals, [cardLink(card)]), card, queueStatus(s, ctx))
}

function intentGuardrail(s: EngineState, ctx: Ctx, action: GuardrailAction): EngineState {
  const reply = ctx.copy.reply
  if (action === "reschedule") {
    const hits = matchPosts(s, lastUserText(s))
    const target = hits.length === 1 ? hits[0] : s.posts[contextPostId(s) ?? ""]
    if (!target) return say(s, ctx, reply.whichPost)
    const when = formatWhen(target.scheduledDate, target.scheduledTime ?? "09:00")
    const { state, requestId } = upsertRequest(s, ctx, action, [target.id], when)
    return say(state, ctx, reply.reschedule(postTitle(s, target.id), when), [{ kind: "approval", requestId }])
  }
  if (action === "bulk_approve") {
    const ids = draftPostIds(s)
    const undecided = ids.filter((id) => !s.drafts.approved.includes(id) && !s.drafts.submitted.includes(id))
    const postIds = undecided.length ? undecided : ids
    if (postIds.length === 0) return say(s, ctx, reply.whichPost)
    const { state, requestId } = upsertRequest(s, ctx, action, postIds)
    return say(state, ctx, reply.guardrailBulk, [{ kind: "approval", requestId }])
  }
  const hits = matchPosts(s, lastUserText(s))
  const target = hits.length === 1 ? hits[0].id : hits.length === 0 ? (activeDraftId(s) ?? contextPostId(s)) : null
  if (!target) return say(s, ctx, reply.whichPost)
  const { state, requestId } = upsertRequest(s, ctx, action, [target])
  return say(state, ctx, action === "publish" ? reply.guardrailPublish : reply.guardrailDelete, [{ kind: "approval", requestId }])
}

function intentPostContext(s: EngineState, ctx: Ctx): EngineState {
  const postId = contextPostId(s)
  if (!postId) return intentFallback(s, ctx)
  const card: CanvasCard = { kind: "current_item", postId, origin: "context" }
  return showCard(say(s, ctx, ctx.copy.reply.rPost(postTitle(s, postId)), [cardLink(card)]), card, "ready")
}

function intentFallback(s: EngineState, ctx: Ctx): EngineState {
  const card = directionsCard(s, "first")
  return showCard(say({ ...s, ideaSet: "first" }, ctx, ctx.copy.reply.fallback, [cardLink(card)]), card, "ready")
}

function applyIntent(s: EngineState, ctx: Ctx, intent: Intent): EngineState {
  switch (intent) {
    case "ideas":
      return intentIdeas(s, ctx)
    case "more_ideas":
      return intentMoreIdeas(s, ctx)
    case "compare":
      return intentCompare(s, ctx)
    case "plan":
      return intentPlan(s, ctx, false)
    case "create":
      return intentCreate(s, ctx, false)
    case "drafts":
      return intentDrafts(s, ctx)
    case "tighten":
      return intentTighten(s, ctx, null)
    case "schedule":
      return intentSchedule(s, ctx)
    case "approvals":
      return intentApprovals(s, ctx)
    case "post_context":
      return intentPostContext(s, ctx)
    case "fallback":
      return intentFallback(s, ctx)
    case "guardrail:publish":
      return intentGuardrail(s, ctx, "publish")
    case "guardrail:delete":
      return intentGuardrail(s, ctx, "delete")
    case "guardrail:bulk_approve":
      return intentGuardrail(s, ctx, "bulk_approve")
    case "guardrail:reschedule":
      return intentGuardrail(s, ctx, "reschedule")
  }
}

function routeText(s: EngineState, ctx: Ctx, text: string): EngineState {
  const intent = routeIntent(text, routerContext(s))
  return applyIntent({ ...s, usage: { ...s.usage, used: s.usage.used + 1 } }, ctx, intent)
}

function userSent(s: EngineState, ctx: Ctx, text: string, source: "typed" | "voice" | "chip"): EngineState {
  let next: EngineState = { ...s, lastEventKind: "user" }
  if (next.usage.used >= next.usage.limit) {
    next = userLine(next, ctx, text, { source })
    return say(next, ctx, ctx.copy.reply.cap(next.usage.limit), [{ kind: "cap" }])
  }
  if (next.run?.status === "running") {
    next = userLine(next, ctx, text, { source, queued: true })
    return say({ ...next, queue: [...next.queue, text] }, ctx, ctx.copy.reply.queuedAck)
  }
  return routeText(userLine(next, ctx, text, { source }), ctx, text)
}

function drainQueue(s: EngineState, ctx: Ctx): EngineState {
  let next = s
  while (next.queue.length > 0 && next.run?.status !== "running") {
    const [text, ...rest] = next.queue
    const index = next.transcript.findIndex((e) => e.queued && e.text === text)
    const transcript = index < 0 ? next.transcript : next.transcript.map((e, i) => (i === index ? { ...e, queued: false } : e))
    next = routeText({ ...next, queue: rest, transcript }, ctx, text)
  }
  return next
}

function scheduleRequestForStage(s: EngineState): GuardrailRequest | undefined {
  return [...s.requests].reverse().find((r) => r.action === "schedule" && (r.status === "approved" || r.status === "submitted"))
}

function completeRun(s: EngineState, ctx: Ctx, run: Run): EngineState {
  let next = log(s, ctx, { kind: "run", runId: run.id, steps: run.steps, actor: { kind: "assistant" } })
  if (run.kind === "plan_to_drafts" || run.kind === "create_drafts") {
    if (run.kind === "plan_to_drafts") {
      const chosen = next.chosenIdeaId ?? "idea-1"
      next = { ...next, chosenIdeaId: chosen, brief: { ...next.brief, campaignName: briefName(next, chosen) } }
    }
    next = { ...next, drafts: { ...next.drafts, visible: true } }
    const card: CanvasCard = { kind: "drafts", activeIndex: 0 }
    next = showCard(say(next, ctx, ctx.copy.reply.created, [cardLink(card)]), card, "needs_you")
    next = log(next, ctx, { kind: "drafted", count: draftPostIds(next).length, actor: { kind: "assistant" } })
  } else {
    const request = scheduleRequestForStage(next)
    const contributorPath = request?.status === "submitted"
    const ids = draftPostIds(next)
    if (contributorPath) {
      for (const postId of ids) next = submitPost(next, ctx, postId)
    } else {
      next = { ...next, staged: next.schedule.map((slot) => ({ ...slot })) }
      for (const postId of ids) next = patchPost(next, postId, { status: "review" })
    }
    const card: CanvasCard = { kind: "handoff" }
    next = showCard(say(next, ctx, contributorPath ? ctx.copy.reply.stagedContributor : ctx.copy.reply.staged, [cardLink(card)]), card, "ready")
    next = log(next, ctx, { kind: "staged", count: ids.length, actor: { kind: "assistant" } })
  }
  return drainQueue(next, ctx)
}

function runTick(s: EngineState, ctx: Ctx): EngineState {
  const run = s.run
  if (!run || run.status !== "running") return s
  const i = run.steps.findIndex((step) => step.state === "running")
  if (i < 0) return s
  let next: EngineState = { ...s, lastEventKind: "run" }
  const failAt = run.kind === "create_drafts" ? 2 : 1
  if (next.failNext && i === failAt) {
    const error = RUN_TEMPLATES[run.kind].steps[i]?.error ?? ctx.copy.cards.shell.errorBody
    const failed: Run = { ...run, status: "error", steps: run.steps.map((step, k) => (k === i ? { ...step, state: "failed", error, finishedAt: ctx.now } : step)) }
    next = setCanvasStatus(setRun({ ...next, failNext: false }, failed), "error")
    next = say(next, ctx, ctx.copy.reply.error, [{ kind: "error", runId: run.id }])
    return log(next, ctx, { kind: "run", runId: run.id, steps: failed.steps, actor: { kind: "assistant" } })
  }
  const last = i === run.steps.length - 1
  const steps = run.steps.map((step, k) => {
    if (k === i) return { ...step, state: "done" as const, finishedAt: ctx.now }
    if (k === i + 1) return { ...step, state: "running" as const, startedAt: ctx.now }
    return step
  })
  if (!last) return effect(setRun(next, { ...run, steps }), { type: "tick", delayMs: STEP_MS[ctx.env.speed] })
  const done: Run = { ...run, steps, status: "done", finishedAt: ctx.now }
  next = setRun(next, done)
  return completeRun(next, ctx, done)
}

function runStop(s: EngineState, ctx: Ctx): EngineState {
  const run = s.run
  if (!run || run.status !== "running") return s
  const steps = run.steps.map((step) => (step.state === "running" || step.state === "pending" ? { ...step, state: "cancelled" as const } : step))
  let next = setRun(s, { ...run, status: "cancelled", steps, finishedAt: ctx.now })
  next = say(next, ctx, ctx.copy.reply.stopped)
  if (run.kind === "create_drafts") {
    const wrote = steps.some((step, k) => k >= 1 && step.state === "done")
    if (wrote) next = { ...next, drafts: { ...next.drafts, visible: true } }
    return showCard(next, wrote ? { kind: "drafts", activeIndex: 0 } : { kind: "brief" }, "ready")
  }
  return setCanvasStatus(next, "ready")
}

function retry(s: EngineState, ctx: Ctx): EngineState {
  const run = s.run
  if (!run || run.status !== "error") return s
  const steps = run.steps.map((step) => {
    if (step.state !== "failed") return step
    return { ...step, state: "running" as const, startedAt: ctx.now, error: undefined, finishedAt: undefined }
  })
  let next = setCanvasStatus(setRun(s, { ...run, status: "running", steps }), "streaming")
  next = say(next, ctx, ctx.copy.reply.retryAck)
  return effect(next, { type: "tick", delayMs: STEP_MS[ctx.env.speed] })
}

function build(s: EngineState, ctx: Ctx, ideaId: string): EngineState {
  let next: EngineState = { ...s, chosenIdeaId: ideaId, brief: { ...s.brief, campaignName: briefName(s, ideaId) } }
  next = userLine(next, ctx, ctx.copy.reply.buildUser)
  const card: CanvasCard = { kind: "brief" }
  return showCard(say(next, ctx, ctx.copy.reply.build, [cardLink(card)]), card, "ready")
}

function draftsApprove(s: EngineState, ctx: Ctx, postId: string): EngineState {
  if (!isApproverRole(ctx.env.role) || s.drafts.approved.includes(postId)) return s
  let next = approveDraftState(s, ctx, postId)
  const n = Math.max(1, draftPostIds(s).indexOf(postId) + 1)
  next = effect(next, { type: "toast", message: ctx.copy.cards.drafts.approvedToast(n), undo: { type: "card_action", action: { card: "drafts", kind: "undo_approve", postId } } })
  if (allDraftsApproved(next)) {
    next = say({ ...next, pendingOffer: "schedule" }, ctx, ctx.copy.reply.approvedAll)
    return next.canvas.card?.kind === "drafts" ? setCanvasStatus(next, "done") : next
  }
  return say(next, ctx, ctx.copy.reply.approvedOne)
}

function draftsUndoApprove(s: EngineState, ctx: Ctx, postId: string): EngineState {
  if (!s.drafts.approved.includes(postId)) return s
  let next: EngineState = { ...s, drafts: { ...s.drafts, approved: s.drafts.approved.filter((id) => id !== postId) } }
  next = setReviewState(next, postId, "pending")
  if (next.pendingOffer === "schedule") next = { ...next, pendingOffer: null }
  if (next.canvas.card?.kind === "drafts") next = setCanvasStatus(next, "needs_you")
  return log(next, ctx, { kind: "undone", postId })
}

function openItem(s: EngineState, ctx: Ctx, itemId: string): EngineState {
  const entry = deriveQueue(s, ctx.viewer).find((q) => q.item.id === itemId)
  if (entry?.item.source === "guardrail") return effect(s, { type: "scroll_to", requestId: entry.item.requestId })
  const fromQueue = entry && "postId" in entry.item ? entry.item.postId : null
  const postId = fromQueue ?? (s.posts[itemId] ? itemId : null)
  if (!postId) return s
  const card: CanvasCard = { kind: "current_item", postId, origin: "queue" }
  return showCard(say(s, ctx, ctx.copy.reply.openItem(postTitle(s, postId)), [cardLink(card)]), card, "ready")
}

function cardAction(s: EngineState, ctx: Ctx, action: CardAction): EngineState {
  const copy = ctx.copy
  switch (action.card) {
    case "directions": {
      const current = s.canvas.card?.kind === "directions" ? s.canvas.card : null
      if (action.kind === "select") return current ? { ...s, canvas: { ...s.canvas, card: { ...current, selectedId: action.ideaId } } } : s
      if (action.kind === "build") return build(s, ctx, current?.selectedId ?? s.chosenIdeaId ?? "idea-1")
      if (action.kind === "compare") return intentCompare(s, ctx)
      return intentMoreIdeas(s, ctx)
    }
    case "recommendation": {
      if (action.kind === "keep_exploring") return intentIdeas(s, ctx)
      const ideaId = s.canvas.card?.kind === "recommendation" ? s.canvas.card.ideaId : (s.chosenIdeaId ?? "idea-1")
      return build(s, ctx, ideaId)
    }
    case "brief": {
      if (action.kind === "edit") return { ...s, brief: { ...s.brief, ...action.patch } }
      if (action.kind === "create") return intentCreate(s, ctx, true)
      return effect(say(s, ctx, copy.reply.debateBrief), { type: "focus_composer" })
    }
    case "drafts": {
      switch (action.kind) {
        case "tab":
          return s.canvas.card?.kind === "drafts" ? { ...s, canvas: { ...s.canvas, card: { kind: "drafts", activeIndex: action.index } } } : s
        case "approve":
          return draftsApprove(s, ctx, action.postId)
        case "undo_approve":
          return draftsUndoApprove(s, ctx, action.postId)
        case "submit":
          if (ctx.env.role !== "contributor" || s.drafts.submitted.includes(action.postId)) return s
          return say(submitPost(s, ctx, action.postId), ctx, copy.reply.submittedOne)
        case "tighten":
          return intentTighten(s, ctx, action.postId)
        case "plan_schedule":
          return intentSchedule(s, ctx)
      }
    }
    case "schedule": {
      if (action.kind === "edit_slot") {
        return { ...s, schedule: s.schedule.map((slot, i) => (i === action.index ? { ...slot, ...action.patch } : slot)) }
      }
      if (action.kind === "cadence") return effect(say(s, ctx, copy.reply.cadence), { type: "focus_composer" })
      let next = userLine(s, ctx, copy.reply.confirmUser)
      const { state, requestId } = upsertRequest(next, ctx, "schedule", draftPostIds(next))
      next = say(state, ctx, copy.reply.approvalAsk, [{ kind: "approval", requestId }])
      return showCard(next, { kind: "schedule", requestId }, "needs_you")
    }
    case "handoff":
      if (action.kind === "open_calendar") {
        const postId = contextPostId(s)
        const date = postId ? s.posts[postId]?.scheduledDate : s.context.kind === "calendar" ? s.context.week : undefined
        return effect(s, { type: "navigate", view: "interface", ...(date ? { week: weekOf(date) } : {}) })
      }
      return intentApprovals(s, ctx)
    case "approvals_queue": {
      if (action.kind === "open_activity") return effect(s, { type: "open_sheet", sheet: "activity" })
      if (action.kind === "open_item") return openItem(s, ctx, action.itemId)
      const first = deriveQueue(s, ctx.viewer).find((q) => q.needsViewer)
      return first ? openItem(s, ctx, first.item.id) : say(s, ctx, copy.reply.approvals)
    }
    case "current_item": {
      const postId = s.canvas.card?.kind === "current_item" ? s.canvas.card.postId : null
      if (!postId) return s
      if (action.kind === "open_editor") {
        const post = s.posts[postId]
        return effect(s, {
          type: "navigate",
          view: "interface",
          ...(post?.scheduledDate ? { week: weekOf(post.scheduledDate) } : {}),
          post: postId,
        })
      }
      const next = applyCaption(s, ctx, postId, action.blurb, ctx.viewer.id)
      return say(effect(next, { type: "toast", message: copy.cards.current.applied }), ctx, copy.reply.appliedEdit)
    }
  }
}

function resolveRequestId(s: EngineState, requestId: string): GuardrailRequest | undefined {
  if (requestId === "latest") return [...s.requests].reverse().find((r) => r.status === "pending")
  return s.requests.find((r) => r.id === requestId)
}

function patchRequest(s: EngineState, id: string, patch: Partial<GuardrailRequest>): EngineState {
  return { ...s, requests: s.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
}

function requestResolved(s: EngineState, ctx: Ctx, event: Extract<EngineEvent, { type: "request_resolved" }>): EngineState {
  const request = resolveRequestId(s, event.requestId)
  if (!request || request.status !== "pending") return s
  const copy = ctx.copy
  if (event.outcome === "changes_requested") {
    const feedback = event.feedback?.trim() ?? ""
    let next = patchRequest(s, request.id, { status: "changes_requested", resolvedAt: ctx.at, feedback })
    next = log(next, ctx, { kind: "changes_requested" })
    next = say(next, ctx, copy.reply.changesAck(feedback))
    return setCanvasStatus(next, "ready")
  }
  if (!isApproverRole(ctx.env.role)) {
    const next = patchRequest(s, request.id, { status: "submitted", resolvedAt: ctx.at })
    return request.action === "schedule" ? startRun(setCanvasStatus(next, "streaming"), ctx, "stage_schedule", nextId(ctx, "run")) : next
  }
  let next = patchRequest(s, request.id, { status: "approved", resolvedAt: ctx.at })
  next = log(next, ctx, { kind: "request_approved" })
  next = effect(next, { type: "toast", message: copy.approval.approvedToast(verbFor(copy, request)), undo: { type: "request_undo", requestId: request.id } })
  switch (request.action) {
    case "schedule":
      return startRun(setCanvasStatus(next, "streaming"), ctx, "stage_schedule", nextId(ctx, "run"))
    case "reschedule": {
      const post = next.posts[RESCHEDULE_TARGET.postId]
      if (!post) return next
      const blurb = REFINE_VARIANTS[RESCHEDULE_TARGET.postId]?.shorter ?? post.blurb ?? ""
      return patchPost(next, RESCHEDULE_TARGET.postId, { scheduledDate: RESCHEDULE_TARGET.date, scheduledTime: RESCHEDULE_TARGET.time, blurb, contentRev: post.contentRev + 1 })
    }
    case "bulk_approve": {
      for (const postId of request.postIds) {
        next = draftPostIds(next).includes(postId) ? approveDraftState(next, ctx, postId) : patchPost(next, postId, { status: "review" })
      }
      return next
    }
    case "publish":
      for (const postId of request.postIds) next = patchPost(next, postId, { status: "scheduled" })
      return next
    case "delete":
      for (const postId of request.postIds) next = patchPost(next, postId, { status: "archived" })
      return next
  }
}

function requestUndo(s: EngineState, ctx: Ctx, requestId: string): EngineState {
  const request = s.requests.find((r) => r.id === requestId)
  if (!request || request.status !== "approved") return s
  const run = s.run?.kind === "stage_schedule" ? s.run : null
  if (request.action === "schedule" && run?.status === "done") return s
  let next = patchRequest(s, request.id, { status: "pending", resolvedAt: undefined })
  next = log(next, ctx, { kind: "undone" })
  if (request.action === "schedule") {
    if (run && run.status === "running") {
      const steps = run.steps.map((step) => (step.state === "running" || step.state === "pending" ? { ...step, state: "cancelled" as const } : step))
      next = setRun(next, { ...run, status: "cancelled", steps, finishedAt: ctx.now })
    }
    next = { ...next, staged: [] }
    for (const postId of request.postIds) next = patchPost(next, postId, { status: POSTS[postId]?.status ?? next.posts[postId]?.status ?? "idea" })
    next = {
      ...next,
      submissions: next.submissions.filter((sub) => !(request.postIds.includes(sub.postId) && !sub.decision)),
      drafts: { ...next.drafts, submitted: [] },
    }
    next = showCard(next, { kind: "schedule", requestId: request.id }, "needs_you")
    return say(next, ctx, ctx.copy.reply.undoneSchedule)
  }
  for (const postId of request.postIds) {
    const original = POSTS[postId]
    if (!original) continue
    if (request.action === "bulk_approve" && draftPostIds(next).includes(postId)) {
      next = { ...next, drafts: { ...next.drafts, approved: next.drafts.approved.filter((id) => id !== postId) } }
      next = setReviewState(next, postId, "pending")
    } else if (request.action === "reschedule") {
      const post = next.posts[postId]
      next = patchPost(next, postId, { scheduledDate: original.scheduledDate, scheduledTime: original.scheduledTime, blurb: original.blurb, contentRev: (post?.contentRev ?? original.contentRev) + 1 })
    } else {
      next = patchPost(next, postId, { status: original.status })
    }
  }
  return say(next, ctx, ctx.copy.approval.undone)
}

function eligibleApproverCount(submittedBy: string): number {
  return TEAM.filter((m) => isApproverRole(m.role) && m.id !== submittedBy).length
}

function submissionDecided(s: EngineState, ctx: Ctx, event: Extract<EngineEvent, { type: "submission_decided" }>): EngineState {
  const sub = openSubmission(s, event.postId)
  const post = s.posts[event.postId]
  if (!sub || !post || !isApproverRole(ctx.env.role) || sub.submittedBy === ctx.viewer.id) return s
  const viewerName = memberName(ctx.viewer.id)
  if (event.outcome === "sent_back") {
    if (!event.reason) return s
    let next = replaceSubmission(s, sub, { ...sub, decision: { by: ctx.viewer.id, at: ctx.at, outcome: "sent_back", reason: event.reason, ...(event.note ? { note: event.note } : {}) } })
    next = patchPost(next, event.postId, { status: "brief" })
    next = systemNote(next, ctx, event.postId, "sent_back", ctx.viewer.id, ctx.copy.notes.system.sentBack(viewerName, REJECT_REASON_LABELS[event.reason]), {
      reason: event.reason,
      ...(event.note ? { detail: event.note } : {}),
    })
    next = log(next, ctx, { kind: "sent_back", postId: event.postId })
    const isCurrent = next.canvas.card?.kind === "current_item" && next.canvas.card.postId === event.postId
    return isCurrent ? say(next, ctx, ctx.copy.reply.sentBack(postTitle(next, event.postId))) : next
  }
  if (sub.approvals.some((a) => a.by === ctx.viewer.id && a.rev === post.contentRev)) return s
  const request: GuardrailRequest = { id: nextId(ctx, "req"), action: "schedule", postIds: [event.postId], status: "approved", requestedAt: ctx.at, resolvedAt: ctx.at }
  let next: EngineState = { ...s, requests: [...s.requests, request] }
  const approvals = [...sub.approvals, { by: ctx.viewer.id, at: ctx.at, rev: post.contentRev }]
  const current = approvals.filter((a) => a.rev === post.contentRev).length
  const needed = Math.min(sub.requiredApprovers, eligibleApproverCount(sub.submittedBy))
  const complete = current >= needed
  next = replaceSubmission(next, sub, { ...sub, approvals, ...(complete ? { decision: { by: ctx.viewer.id, at: ctx.at, outcome: "approved" as const } } : {}) })
  if (complete) next = patchPost(next, event.postId, { status: "scheduled" })
  next = systemNote(next, ctx, event.postId, "approved", ctx.viewer.id, ctx.copy.notes.system.approved(viewerName))
  next = log(next, ctx, { kind: "approved", postId: event.postId })
  return log(next, ctx, { kind: "request_approved", postId: event.postId })
}

function submissionWithdrawn(s: EngineState, ctx: Ctx, postId: string): EngineState {
  const sub = openSubmission(s, postId)
  if (!sub || sub.submittedBy !== ctx.viewer.id) return s
  let next = replaceSubmission(s, sub, null)
  next = patchPost(next, postId, { status: "brief" })
  if (next.drafts.submitted.includes(postId)) next = { ...next, drafts: { ...next.drafts, submitted: next.drafts.submitted.filter((id) => id !== postId) } }
  next = systemNote(next, ctx, postId, "withdrawn", ctx.viewer.id, ctx.copy.approve.withdrawn)
  return log(next, ctx, { kind: "withdrawn", postId })
}

function currentDeckPost(s: EngineState): string | null {
  return s.deck.order[s.deck.index] ?? null
}

function deckDecide(s: EngineState, ctx: Ctx, postId: string, outcome: "approved" | "skipped" | "submitted"): EngineState {
  const copy = ctx.copy
  const deck = s.deck
  if (outcome === "skipped") {
    const skippedBefore = deck.decisions.some((d) => d.postId === postId && d.outcome === "skipped")
    const decisions = [...deck.decisions, { postId, outcome }]
    if (skippedBefore) return { ...s, deck: { ...deck, decisions, index: deck.index + 1 } }
    return { ...s, deck: { ...deck, decisions, order: [...deck.order.filter((id) => id !== postId), postId] } }
  }
  const contributor = ctx.env.role === "contributor"
  const finalOutcome = contributor || outcome === "submitted" ? "submitted" : "approved"
  let next = s
  if (finalOutcome === "submitted") {
    if (!contributor) return s
    next = submitPost(next, ctx, postId)
  } else if (draftPostIds(s).includes(postId)) {
    next = approveDraftState(next, ctx, postId)
  } else {
    next = log(patchPost(next, postId, { status: "review" }), ctx, { kind: "approved", postId })
  }
  next = { ...next, deck: { ...next.deck, decisions: [...next.deck.decisions, { postId, outcome: finalOutcome }], index: next.deck.index + 1 } }
  const message = finalOutcome === "approved" ? copy.mobile.deck.approvedToast : copy.approval.submitted
  return effect(next, { type: "toast", message, undo: { type: "deck_undo" } })
}

function deckUndo(s: EngineState, ctx: Ctx): EngineState {
  const decisions = s.deck.decisions
  const last = decisions[decisions.length - 1]
  if (!last) return s
  const rest = decisions.slice(0, -1)
  let next: EngineState = s
  let order = s.deck.order
  let index = s.deck.index
  if (last.outcome === "skipped") {
    const moved = !rest.some((d) => d.postId === last.postId && d.outcome === "skipped")
    if (moved) {
      const without = order.filter((id) => id !== last.postId)
      order = [...without.slice(0, index), last.postId, ...without.slice(index)]
    } else {
      index = order.indexOf(last.postId)
    }
  } else {
    index = order.indexOf(last.postId)
    const original = POSTS[last.postId]
    if (last.outcome === "approved" && draftPostIds(next).includes(last.postId)) {
      next = { ...next, drafts: { ...next.drafts, approved: next.drafts.approved.filter((id) => id !== last.postId) } }
      next = setReviewState(next, last.postId, "pending")
    } else {
      if (last.outcome === "submitted") {
        const sub = openSubmission(next, last.postId)
        if (sub && sub.submittedBy === ctx.viewer.id) next = replaceSubmission(next, sub, null)
        next = { ...next, drafts: { ...next.drafts, submitted: next.drafts.submitted.filter((id) => id !== last.postId) } }
      }
      if (original) next = patchPost(next, last.postId, { status: original.status })
    }
    next = log(next, ctx, { kind: "undone", postId: last.postId })
  }
  return { ...next, deck: { ...next.deck, decisions: rest, order, index: Math.max(0, index) } }
}

function refineText(text: string, kind: RefineKind): string {
  if (kind === "new_image" || kind === "funnier") return text
  const cut = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text
  if (cut.length > 0 && cut.length < text.length) return cut
  const words = text.split(/\s+/).filter(Boolean)
  return words.length > 1 ? words.slice(0, -1).join(" ") : text
}

function deckRefined(s: EngineState, ctx: Ctx, postId: string, kind: RefineKind): EngineState {
  const post = s.posts[postId]
  let next: EngineState = { ...s, deck: { ...s.deck, refining: null } }
  if (!post) return next
  const source = post.blurb || post.brief || post.tile.headline || ""
  const variant = REFINE_VARIANTS[postId]?.[kind] ?? refineText(source, kind)
  if (!variant) return next
  next =
    kind === "new_image"
      ? applyCaption(next, ctx, postId, post.blurb ?? "", ctx.viewer.id, { tile: { ...post.tile, headline: variant } })
      : applyCaption(next, ctx, postId, variant, ctx.viewer.id)
  return effect(next, { type: "announce", message: kind === "new_image" ? ctx.copy.mobile.deck.imageUpdated : ctx.copy.mobile.deck.captionUpdated })
}

function deckRefine(s: EngineState, ctx: Ctx, postId: string, kind: RefineKind): EngineState {
  const next: EngineState = { ...s, deck: { ...s.deck, refining: { postId, kind } } }
  return effect(next, { type: "tick", delayMs: ctx.env.speed === "instant" ? 0 : 800, event: { type: "deck_refined", postId, kind } })
}

function voiceCommand(s: EngineState, ctx: Ctx, scriptId: VoiceScriptId): EngineState {
  const script = VOICE_SCRIPTS[scriptId]
  const current = currentDeckPost(s)
  const command = script.command
  if (command === "shorter" || command === "funnier" || command === "new_image") {
    return current ? deckRefined(s, ctx, current, command) : s
  }
  if (command === "skip") return current ? deckDecide(s, ctx, current, "skipped") : s
  if (command === "approve") return current ? deckDecide(s, ctx, current, "approved") : s
  return userSent(s, ctx, script.sendText, "voice")
}

function teammate(s: EngineState, ctx: Ctx, act: "note" | "mention" | "react" | "edit_after_approval"): EngineState {
  const designer = memberName(DESIGNER_ID)
  const target = activeDraftId(s) ?? "p-wed"
  const actor = { kind: "user" as const, userId: DESIGNER_ID }
  if (act === "note") {
    const next = log(addNote(s, ctx, { postId: target, authorId: DESIGNER_ID, body: TEAMMATE_NOTE }), ctx, { kind: "note", postId: target, actor })
    return effect(next, { type: "announce", message: ctx.copy.notes.liveNew(designer) })
  }
  if (act === "mention") {
    const name = memberName(ctx.viewer.id)
    const mention = `@${name}`
    const body = `${mention} can you approve this today?`
    let next = addNote(s, ctx, {
      postId: target,
      authorId: DESIGNER_ID,
      body,
      annotations: [{ type: "mention", indices: [0, mention.length], displayValue: mention, userId: ctx.viewer.id }],
      mentionUserIds: [ctx.viewer.id],
    })
    next = log(next, ctx, { kind: "note", postId: target, actor })
    return effect(next, { type: "announce", message: ctx.copy.notes.liveNew(designer) })
  }
  if (act === "react") {
    const own = s.notes.filter((n) => n.authorId === ctx.viewer.id && n.kind === "note")
    const note = own[own.length - 1] ?? s.notes[0]
    if (!note) return s
    const emoji = "🎉" as const
    const existing = note.reactions.find((r) => r.emoji === emoji)
    const reactions = existing
      ? note.reactions.map((r) => (r.emoji === emoji && !r.userIds.includes(DESIGNER_ID) ? { ...r, userIds: [...r.userIds, DESIGNER_ID] } : r))
      : [...note.reactions, { emoji, userIds: [DESIGNER_ID] }]
    const reaction = reactions.find((r) => r.emoji === emoji)
    const next: EngineState = { ...s, notes: s.notes.map((n) => (n.id === note.id ? { ...n, reactions } : n)) }
    return effect(next, { type: "announce", message: ctx.copy.notes.reaction(REACTION_NAMES[emoji], reaction?.userIds.length ?? 1, !!reaction?.userIds.includes(ctx.viewer.id)) })
  }
  const postId = RESCHEDULE_TARGET.postId
  const post = s.posts[postId]
  if (!post) return s
  const blurb = REFINE_VARIANTS[postId]?.funnier ?? post.blurb ?? ""
  const next = applyCaption(s, ctx, postId, blurb, DESIGNER_ID)
  return effect(next, { type: "announce", message: ctx.copy.notes.system.stale(designer) })
}

function handoffIn(s: EngineState, ctx: Ctx, carry: "chat" | "chat_and_item" | "none"): EngineState {
  let next = s
  if (carry !== "none") {
    const moved = s.miniChat.filter((e) => e.id !== MINI_INITIAL_ID)
    const hadUser = moved.some((e) => e.role === "user")
    if (moved.length > 0) {
      const divider: TranscriptEntry = { id: nextId(ctx, "m"), role: "system", divider: "handoff", createdAt: ctx.now }
      next = { ...next, transcript: [...next.transcript, divider, ...moved], miniChat: [initialMini(ctx.copy)] }
    }
    const postId = s.context.kind === "post" ? s.context.postId : null
    if (carry === "chat_and_item" && postId && next.posts[postId]) {
      const card: CanvasCard = { kind: "current_item", postId, origin: "handoff" }
      next = showCard(say(next, ctx, ctx.copy.reply.handoffIn(postTitle(next, postId)), [cardLink(card)]), card, "ready")
    } else if (hadUser) {
      next = say(next, ctx, ctx.copy.reply.handoffInChat)
    }
  }
  next = effect(next, { type: "navigate", view: "timbl" })
  return effect(next, { type: "focus_composer" })
}

function miniSent(s: EngineState, ctx: Ctx, text: string): EngineState {
  const postId = s.context.kind === "post" ? s.context.postId : null
  const reply = postId
    ? ctx.copy.flyout.replyPost(postTitle(s, postId))
    : ctx.copy.flyout.replyContext(s.context.kind === "calendar" ? ctx.copy.flyout.contextCalendar(formatDay(s.context.week)) : ctx.copy.flyout.contextLabel)
  const user: TranscriptEntry = { id: nextId(ctx, "m"), role: "user", text, source: "flyout", createdAt: ctx.now }
  const assistant: TranscriptEntry = { id: nextId(ctx, "m"), role: "assistant", text: reply, createdAt: ctx.now }
  return { ...s, lastEventKind: "user", miniChat: [...s.miniChat, user, assistant], usage: { ...s.usage, used: s.usage.used + 1 } }
}

function showCardEvent(s: EngineState, card: CanvasCard): EngineState {
  const current = s.canvas.card
  if (current && current.kind === card.kind) return effect({ ...s, canvas: { ...s.canvas, visibility: "shown" } }, { type: "canvas_shown" })
  return showCard(s, card, "done")
}

function noteEdit(s: EngineState, ctx: Ctx, noteId: string, body: string | null): EngineState {
  const note = s.notes.find((n) => n.id === noteId)
  if (!note || note.authorId !== ctx.viewer.id || note.kind !== "note") return s
  if (body === null) return { ...s, notes: s.notes.filter((n) => n.id !== noteId) }
  const { annotations, mentionUserIds } = extractMentions(body, TEAM)
  return { ...s, notes: s.notes.map((n) => (n.id === noteId ? { ...n, body, editedAt: ctx.at, updatedAt: ctx.at, annotations, mentionUserIds } : n)) }
}

function noteReact(s: EngineState, ctx: Ctx, noteId: string, emoji: PrototypeNote["reactions"][number]["emoji"]): EngineState {
  const viewer = ctx.viewer.id
  const notes = s.notes.map((n) => {
    if (n.id !== noteId) return n
    const existing = n.reactions.find((r) => r.emoji === emoji)
    if (!existing) return { ...n, reactions: [...n.reactions, { emoji, userIds: [viewer] }] }
    const userIds = existing.userIds.includes(viewer) ? existing.userIds.filter((id) => id !== viewer) : [...existing.userIds, viewer]
    const reactions = userIds.length ? n.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds } : r)) : n.reactions.filter((r) => r.emoji !== emoji)
    return { ...n, reactions }
  })
  return { ...s, notes }
}

function threadRead(s: EngineState, ctx: Ctx, postId: string): EngineState {
  const exists = s.reads.some((r) => r.postId === postId && r.userId === ctx.viewer.id)
  const reads = exists
    ? s.reads.map((r) => (r.postId === postId && r.userId === ctx.viewer.id ? { ...r, lastReadAt: ctx.at } : r))
    : [...s.reads, { postId, userId: ctx.viewer.id, lastReadAt: ctx.at }]
  return { ...s, reads }
}

function withRunningTick(s: EngineState, env: EngineEnv): EngineState {
  return s.run?.status === "running" ? { ...s, effects: [{ type: "tick", delayMs: STEP_MS[env.speed] }] } : s
}

export function reduce(state: EngineState, event: EngineInput): EngineState {
  const { env } = event
  if (event.type === "reset") {
    const next = initialEngineState(env)
    return withRunningTick({
      ...next,
      usage: { ...next.usage, used: event.usage === "cap" ? next.usage.limit : event.usage === "near" ? Math.ceil(next.usage.limit * 0.9) : 0 },
      canvas: { ...next.canvas, visibility: event.canvas },
    }, env)
  }
  const seq = state.seq + 1
  const clock = state.clock + 1000
  const ctx: Ctx = { env, copy: copyFor(env.assistantName), viewer: { id: env.viewerId, role: env.role }, seq, now: clock, at: isoAt(clock), counters: {} }
  const s: EngineState = { ...state, seq, clock, effects: [] }
  const user: EngineState = { ...s, lastEventKind: "user" }
  switch (event.type) {
    case "user_sent":
      return userSent(s, ctx, event.text, event.source)
    case "mini_sent":
      return miniSent(s, ctx, event.text)
    case "new_mini_chat":
      return { ...s, miniChat: [initialMini(ctx.copy), { id: nextId(ctx, "m"), role: "assistant", text: ctx.copy.flyout.newChat, createdAt: clock }] }
    case "card_action":
      return cardAction(user, ctx, event.action)
    case "run_start": {
      const run = s.run
      if (!run || run.status !== "proposed") return s
      return startRun(user, ctx, run.kind, run.id)
    }
    case "run_revise": {
      const run = s.run
      if (!run || run.status !== "proposed") return s
      return effect(say({ ...user, composerDraft: `${run.title}: ` }, ctx, ctx.copy.reply.reviseAck), { type: "focus_composer" })
    }
    case "run_stop":
      return runStop(user, ctx)
    case "run_tick":
      return runTick(s, ctx)
    case "retry":
      return retry(user, ctx)
    case "fail_next":
      return { ...s, failNext: true }
    case "request_resolved":
      return requestResolved(user, ctx, event)
    case "request_undo":
      return requestUndo(user, ctx, event.requestId)
    case "caption_edited":
      return applyCaption(user, ctx, event.postId, event.blurb, ctx.viewer.id)
    case "note_added": {
      const { annotations, mentionUserIds } = extractMentions(event.body, TEAM)
      const next = addNote(user, ctx, { postId: event.postId, authorId: ctx.viewer.id, body: event.body, annotations, mentionUserIds })
      return log(next, ctx, { kind: "note", postId: event.postId })
    }
    case "note_edited":
      return noteEdit(user, ctx, event.noteId, event.body)
    case "note_deleted":
      return noteEdit(user, ctx, event.noteId, null)
    case "note_reacted":
      return noteReact(user, ctx, event.noteId, event.emoji)
    case "thread_read":
      return threadRead(s, ctx, event.postId)
    case "submission_decided":
      return submissionDecided(user, ctx, event)
    case "submission_withdrawn":
      return submissionWithdrawn(user, ctx, event.postId)
    case "deck_decided":
      return deckDecide(user, ctx, event.postId, event.outcome)
    case "deck_refine":
      return deckRefine(user, ctx, event.postId, event.kind)
    case "deck_refined":
      return deckRefined(user, ctx, event.postId, event.kind)
    case "deck_undo":
      return deckUndo(user, ctx)
    case "bulk_requested":
      return upsertRequest(user, ctx, "bulk_approve", event.postIds).state
    case "voice_command":
      return voiceCommand(user, ctx, event.script)
    case "handoff_in":
      return handoffIn(s, ctx, event.carry)
    case "handoff_out": {
      const postId = s.context.kind === "post" ? s.context.postId : null
      const week = postId && s.posts[postId] ? weekOf(s.posts[postId].scheduledDate ?? "") : undefined
      return effect(s, { type: "navigate", view: "interface", ...(week ? { week } : {}) })
    }
    case "canvas_visibility":
      return { ...s, canvas: { ...s.canvas, visibility: event.visibility } }
    case "show_card":
      return showCardEvent(s, event.card)
    case "context_set":
      return { ...s, context: event.context }
    case "teammate":
      return teammate(s, ctx, event.act)
    case "usage_set":
      return { ...s, usage: { ...s.usage, used: USAGE_USED[event.usage] } }
    case "hydrate_thread": {
      if (event.transcript.length === 0) return s
      const seen = new Set(event.transcript.map((entry) => entry.id))
      const extra = s.transcript.filter((entry) => !seen.has(entry.id))
      const transcript = extra.length > 0 ? [...event.transcript, ...extra] : event.transcript
      return { ...s, transcript, miniChat: transcript.slice(-4) }
    }
    case "hydrate_posts": {
      const posts = { ...event.posts }
      for (const [id, prev] of Object.entries(s.posts)) {
        const incoming = posts[id]
        if (prev && incoming && prev.contentRev > incoming.contentRev) posts[id] = prev
        else if (prev && !incoming) posts[id] = prev
      }
      const pending = Object.values(posts)
        .filter((post) => post.agentMeta?.reviewState === "pending" || post.status === "review")
        .map((post) => post.id)
        .sort(byDate({ ...s, posts }))
      return {
        ...s,
        posts,
        deck: s.deck.order.length ? { ...s.deck } : { ...s.deck, order: pending },
      }
    }
    case "hydrate_ideas":
      return { ...s, ideas: event.ideas }
    case "hydrate_glance":
      return { ...s, glance: { reconnectDays: event.reconnectDays, events: event.events } }
    case "assistant_delta": {
      const last = s.transcript[s.transcript.length - 1]
      if (last?.role === "assistant") {
        return {
          ...s,
          transcript: [...s.transcript.slice(0, -1), { ...last, text: `${last.text ?? ""}${event.text}` }],
        }
      }
      return say(s, ctx, event.text)
    }
    case "request_opened": {
      const { state, requestId } = upsertRequest(s, ctx, event.action, event.postIds, event.when)
      if (!event.runId) return state
      return {
        ...state,
        requests: state.requests.map((request) =>
          request.id === requestId ? { ...request, runId: event.runId } : request,
        ),
      }
    }
  }
}

export function sceneOf(state: EngineState): Scene {
  const last = state.transcript[state.transcript.length - 1]
  if (last?.attachments?.some((a) => a.kind === "cap")) return "cap"
  const run = state.run
  const card = state.canvas.card
  if (run?.status === "error") return "error"
  if (!card) {
    if (run?.status === "running") return "working"
    if (run?.status === "proposed") return "plan"
    return "empty"
  }
  switch (card.kind) {
    case "directions":
      return "directions"
    case "recommendation":
      return "recommendation"
    case "brief":
      return "brief"
    case "drafts":
      return "drafts"
    case "schedule": {
      const request = card.requestId ? state.requests.find((r) => r.id === card.requestId) : undefined
      return request?.status === "pending" ? "schedule_approval" : "schedule"
    }
    case "handoff":
      return "handoff"
    case "approvals_queue":
      return "approvals"
    case "current_item":
      return card.origin === "queue" ? "current_queue" : "current"
  }
}

export function deriveChip(state: EngineState, copy: Copy): { state: StateChipState; label: string; shortLabel: string } | null {
  const run = state.run
  if (run?.status === "running") {
    const n = run.steps.length
    const i = Math.max(0, run.steps.findIndex((step) => step.state === "running")) + 1
    return { state: "working", label: copy.chip.working(i, n), shortLabel: copy.chip.workingShort(i, n) }
  }
  if (state.requests.some((r) => r.status === "pending")) return { state: "needs_you", label: copy.chip.needs_you, shortLabel: copy.chip.needs_you }
  if (run?.status === "error") return { state: "error", label: copy.chip.error, shortLabel: copy.chip.error }
  return null
}

function byDate(s: EngineState) {
  return (a: string, b: string) => {
    const pa = s.posts[a]
    const pb = s.posts[b]
    return `${pa?.scheduledDate ?? ""} ${pa?.scheduledTime ?? ""}`.localeCompare(`${pb?.scheduledDate ?? ""} ${pb?.scheduledTime ?? ""}`)
  }
}

export function deriveQueue(state: EngineState, viewer: Viewer): QueueEntry[] {
  const approver = isApproverRole(viewer.role)
  const guardrail: QueueEntry[] = state.requests
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
    .map((r) => ({ item: { id: `q-${r.id}`, source: "guardrail", requestId: r.id }, needsViewer: approver }))
  const contributor: QueueEntry[] = state.submissions
    .filter((sub) => !sub.decision && state.posts[sub.postId])
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((sub) => {
      const rev = state.posts[sub.postId]?.contentRev ?? sub.contentRev
      const approvedAtRev = sub.approvals.some((a) => a.by === viewer.id && a.rev === rev)
      return { item: { id: `q-sub-${sub.postId}`, source: "contributor", postId: sub.postId }, needsViewer: approver && sub.submittedBy !== viewer.id && !approvedAtRev }
    })
  const submitted = new Set(contributor.map((q) => (q.item.source === "contributor" ? q.item.postId : "")))
  const drafts: QueueEntry[] = state.drafts.visible
    ? draftPostIds(state).filter((id) => !submitted.has(id) && state.posts[id]?.agentMeta?.reviewState === "pending")
        .sort(byDate(state))
        .map((id) => ({ item: { id: `q-draft-${id}`, source: "agent_draft", postId: id }, needsViewer: approver }))
    : []
  return [...guardrail, ...contributor, ...drafts]
}

export function deriveGlance(state: EngineState, _viewer: Viewer, copy: Copy): GlanceCard[] {
  const glance = copy.mobile.glance
  const pendingIds = Object.values(state.posts)
    .filter((post) => post.agentMeta?.reviewState === "pending" || post.status === "review")
    .map((post) => post.id)
    .sort(byDate(state))
  const pending = pendingIds.map((id) => state.posts[id]).filter((post): post is PrototypePost => Boolean(post))
  const cards: GlanceCard[] = []
  if (pending.length > 0) {
    cards.push({
      id: "glance-drafts",
      tone: "badge-emerald",
      title: glance.draftsTitle(pending.length),
      line: glance.draftsLine(formatDayShort(pending[0].scheduledDate), formatDayShort(pending[pending.length - 1].scheduledDate)),
      primary: { label: glance.approveAll, target: "approve_all" },
      secondary: { label: glance.review, target: "review" },
    })
  }
  if (state.glance.reconnectDays !== null) {
    cards.push({
      id: "glance-linkedin",
      tone: "warning",
      title: glance.linkedinTitle,
      line: glance.linkedinLine(state.glance.reconnectDays),
      primary: { label: glance.reconnect, target: "reconnect" },
    })
  }
  for (const event of state.glance.events) {
    cards.push({
      id: `glance-${event.date}`,
      tone: "brand-accent",
      title: glance.eventTitle(event.name, daysUntil(event.date)),
      line: glance.eventLine,
      primary: { label: glance.plan, target: "plan" },
    })
  }
  if (cards.length === 0) {
    cards.push({
      id: "glance-plan",
      tone: "brand-accent",
      title: glance.plan,
      line: glance.allClear,
      primary: { label: glance.plan, target: "plan" },
    })
  }
  return cards
}

function inWeek(date: string | undefined, week: string): boolean {
  return !!date && date >= week && date < addDays(week, 7)
}

function postVisible(state: EngineState, postId: string): boolean {
  if (!draftPostIds(state).includes(postId)) return true
  return state.drafts.visible || state.staged.some((slot) => slot.postId === postId) || Boolean(state.posts[postId])
}

export function deriveRail(state: EngineState, viewer: Viewer, week: WeekId): RailData {
  const posts = Object.values(state.posts).filter((p) => postVisible(state, p.id) && inWeek(p.scheduledDate, week))
  const scheduled = posts.filter((p) => p.status === "scheduled").length
  const review = posts.filter((p) => p.status === "review" || p.status === "needs_approval").length
  const live = posts.filter((p) => p.status !== "archived").length
  const stats = { scheduled, review, slots: Math.max(0, BRAND_CADENCE.perWeek - live), campaigns: CAMPAIGNS.filter((c) => c.status === "active").length }
  const attention: RailData["attention"] = []
  const seen = new Set<string>()
  const push = (postId: string, source: RailData["attention"][number]["source"]) => {
    if (seen.has(postId) || !state.posts[postId]) return
    seen.add(postId)
    attention.push({ postId, title: postTitle(state, postId), source, unread: unreadFor(state.notes, state.reads, postId, viewer.id) })
  }
  for (const entry of deriveQueue(state, viewer)) {
    if (!entry.needsViewer) continue
    if (entry.item.source === "guardrail") {
      const requestId = entry.item.requestId
      const request = state.requests.find((r) => r.id === requestId)
      if (request?.postIds[0]) push(request.postIds[0], "guardrail")
    } else {
      push(entry.item.postId, entry.item.source)
    }
  }
  for (const postId of Object.keys(state.posts)) {
    if (!postVisible(state, postId)) continue
    if (unreadFor(state.notes, state.reads, postId, viewer.id).mentions > 0) push(postId, "mention")
  }
  const nowIso = isoAt(FIXTURE_NOW_MS)
  const nowKey = `${nowIso.slice(0, 10)} ${nowIso.slice(11, 16)}`
  const upcoming = new Map<string, { date: string; time: string }>()
  for (const p of Object.values(state.posts)) {
    if (p.status === "scheduled" && p.scheduledDate && p.scheduledTime) upcoming.set(p.id, { date: p.scheduledDate, time: p.scheduledTime })
  }
  for (const slot of state.staged) upcoming.set(slot.postId, { date: slot.date, time: slot.time })
  const comingUp = [...upcoming.entries()]
    .filter(([, when]) => `${when.date} ${when.time}` >= nowKey)
    .sort((a, b) => `${a[1].date} ${a[1].time}`.localeCompare(`${b[1].date} ${b[1].time}`))
    .slice(0, 3)
    .map(([postId, when]) => ({ postId, title: postTitle(state, postId), when: formatWhen(when.date, when.time) }))
  return { stats, attention, comingUp }
}
