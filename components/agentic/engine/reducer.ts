import { REJECT_REASON_LABELS } from "@/lib/schemas/_shared"
import { addDays, daysUntil, formatDayShort, formatWhen, localKey, mondayOf, monthStartLabel, todayIso } from "../clock"
import { makeCopy, type Copy } from "../copy"
import { DEFAULT_BRIEF, RUN_AGENTS } from "../defaults"
import { extractMentions, primaryChannel, unreadFor } from "../lib"
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
  PersistOp,
  PrototypeNote,
  PrototypePost,
  RefineKind,
  Run,
  RunKind,
  ScheduleSlot,
  StateChipState,
  TeamMember,
  TranscriptAttachment,
  TranscriptEntry,
  UserRole,
  WeekId,
} from "../types"
import { routeIntent, type Intent } from "./router"

export type EngineInput = EngineEvent & { env: EngineEnv; now: number }
export type QueueEntry = { item: ApprovalQueueItem; needsViewer: boolean }
export type RailData = {
  stats: { scheduled: number; review: number; slots: number; campaigns: number }
  attention: { postId: string; title: string; source: ApprovalQueueItem["source"] | "mention"; unread: { count: number; mentions: number } }[]
  comingUp: { postId: string; title: string; when: string }[]
}
type Viewer = Pick<TeamMember, "id" | "role">

const MINI_INITIAL_ID = "mini-initial"
const DEFAULT_TIME = "10:00"

const copyCache = new Map<string, Copy>()
function copyFor(name: string): Copy {
  const hit = copyCache.get(name)
  if (hit) return hit
  const built = makeCopy(name)
  copyCache.set(name, built)
  return built
}

type Ctx = {
  env: EngineEnv
  copy: Copy
  viewer: Viewer
  seq: number
  now: number
  at: string
  counter: { n: number }
}

function nextId(ctx: Ctx, prefix: "m" | "act" | "note" | "req" | "run"): string {
  ctx.counter.n += 1
  return `${prefix}-${ctx.now.toString(36)}${ctx.seq.toString(36)}-${ctx.counter.n}`
}

function memberName(ctx: Ctx, id: string): string {
  return ctx.env.team.find((m) => m.id === id)?.name ?? ctx.copy.roles.contributor
}

function isApproverRole(role: UserRole): boolean {
  return role === "admin" || role === "editor"
}

function initialMini(copy: Copy, now: number): TranscriptEntry {
  return { id: MINI_INITIAL_ID, role: "assistant", text: copy.flyout.initial, createdAt: now }
}

export function initialEngineState(env: EngineEnv, now: number): EngineState {
  const copy = copyFor(env.assistantName)
  return {
    seq: 0,
    clock: now,
    transcript: [{ id: "m-intro", role: "assistant", text: copy.reply.intro, createdAt: 0 }],
    miniChat: [initialMini(copy, now)],
    queue: [],
    canvas: { card: null, status: "ready", visibility: "shown" },
    run: null,
    runs: [],
    requests: [],
    posts: {},
    drafts: { visible: false, ids: [], approved: [], submitted: [] },
    deck: { order: [], index: 0, decisions: [], refining: null },
    skippedPostIds: [],
    notes: [],
    reads: [],
    submissions: [],
    activity: [],
    ideaSet: "first",
    chosenIdeaId: null,
    ideas: {},
    glance: { reconnectDays: null, events: [] },
    brief: { ...DEFAULT_BRIEF },
    schedule: [],
    staged: [],
    context: { kind: "none" },
    usage: { used: 0, limit: Number.POSITIVE_INFINITY },
    composerDraft: "",
    pendingOffer: null,
    lastEventKind: null,
    effects: [],
  }
}

function effect(s: EngineState, e: EngineEffect): EngineState {
  return { ...s, effects: [...s.effects, e] }
}

function persist(s: EngineState, op: PersistOp): EngineState {
  return effect(s, { type: "persist", op })
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

function upsertRunLog(s: EngineState, ctx: Ctx, run: Run): EngineState {
  const existing = s.activity.find((entry) => entry.kind === "run" && entry.runId === run.id)
  if (!existing) return log(s, ctx, { kind: "run", runId: run.id, steps: run.steps, actor: { kind: "assistant" } })
  return { ...s, activity: s.activity.map((entry) => (entry === existing ? { ...entry, steps: run.steps } : entry)) }
}

function announce(s: EngineState, message: string): EngineState {
  return effect(s, { type: "announce", message })
}

function showCard(s: EngineState, card: CanvasCard, status: CardStatus): EngineState {
  return effect({ ...s, canvas: { card, status, visibility: s.canvas.visibility === "expanded" ? "expanded" : "shown" } }, { type: "canvas_shown" })
}

function setCanvasStatus(s: EngineState, status: CardStatus): EngineState {
  return { ...s, canvas: { ...s.canvas, status } }
}

function setRun(s: EngineState, run: Run): EngineState {
  const exists = s.runs.some((r) => r.id === run.id)
  return { ...s, run, runs: exists ? s.runs.map((r) => (r.id === run.id ? run : r)) : [...s.runs, run] }
}

function findRun(s: EngineState, runId: string): Run | undefined {
  return s.run?.id === runId ? s.run : s.runs.find((r) => r.id === runId)
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
  const post = s.posts[postId]
  return post?.brief || post?.blurb?.slice(0, 60) || post?.tile.headline || ""
}

function addNote(
  s: EngineState,
  ctx: Ctx,
  note: { postId: string; authorId: string; body: string; kind?: "note" | "system"; system?: NoteSystemEvent; annotations?: PrototypeNote["annotations"]; mentionUserIds?: string[] },
): { state: EngineState; id: string } {
  const id = nextId(ctx, "note")
  const full: PrototypeNote = {
    id,
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
  return { state: { ...s, notes: [...s.notes, full] }, id }
}

function systemNote(s: EngineState, ctx: Ctx, postId: string, event: NoteSystemEvent["event"], actorId: string, body: string, extra: Partial<NoteSystemEvent> = {}): EngineState {
  return addNote(s, ctx, { postId, authorId: actorId, body, kind: "system", system: { event, actorId, ...extra } }).state
}

function draftPostIds(s: EngineState): string[] {
  return s.drafts.ids.filter((id) => s.posts[id] && s.posts[id].status !== "archived")
}

function ideaList(s: EngineState, set: "first" | "more"): string[] {
  const ids = Object.values(s.ideas)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .map((idea) => idea.id)
  return set === "more" ? ids.slice(3, 6) : ids.slice(0, 3)
}

function lastUserText(s: EngineState): string {
  return [...s.transcript].reverse().find((entry) => entry.role === "user")?.text ?? ""
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

function dayMentions(text: string): number[] {
  const t = text.toLowerCase()
  const found: { at: number; day: number }[] = []
  WEEKDAYS.forEach((name, day) => {
    const match = new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`).exec(t)
    if (match) found.push({ at: match.index, day })
  })
  if (/\btoday\b/.test(t)) found.push({ at: t.indexOf("today"), day: weekdayOf(todayIso()) })
  if (/\btomorrow\b/.test(t)) found.push({ at: t.indexOf("tomorrow"), day: weekdayOf(addDays(todayIso(), 1)) })
  return found.sort((a, b) => a.at - b.at).map((f) => f.day)
}

function matchPosts(s: EngineState, text: string): PrototypePost[] {
  const t = text.toLowerCase()
  const all = Object.values(s.posts).filter((p) => p.status !== "archived" && p.status !== "posted")
  const typeMatch = (["reel", "carousel", "story", "grid", "video"] as const).find((key) => t.includes(key))
  const day = /\b(to|for)\b/.test(t) ? undefined : dayMentions(text)[0]
  const stop = new Set(["delete", "remove", "publish", "schedule", "reschedule", "move", "post", "this", "that", "the", "and", "for", "with", "from", "into", "reel", "carousel", "story", "grid", "video", "today", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])
  const words = t.split(/[^a-z0-9'-]+/).filter((word) => word.length > 3 && !stop.has(word))
  const named = all.filter((p) => {
    const hay = `${p.brief ?? ""} ${p.blurb ?? ""}`.toLowerCase()
    if (hay.length > 3 && t.includes(hay.trim())) return true
    const hits = words.filter((word) => hay.includes(word))
    return words.length > 0 && hits.length === words.length
  })
  if (named.length > 0) return named
  return all.filter((p) => (!typeMatch || p.postType === typeMatch) && (day === undefined || (p.scheduledDate && weekdayOf(p.scheduledDate) === day)))
    .filter(() => typeMatch !== undefined || day !== undefined)
}

function activeDraftId(s: EngineState): string | null {
  const ids = draftPostIds(s)
  return s.canvas.card?.kind === "drafts" ? (ids[s.canvas.card.activeIndex] ?? ids[0] ?? null) : null
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
  let next = patchPost(s, postId, { ...extra, blurb, contentRev: Math.max(ctx.now, oldRev + 1) })
  next = persist(next, { kind: "caption", postId, blurb })
  const sub = latestSubmission(next, postId)
  const hadApproval = !!sub && (sub.decision?.outcome === "approved" || sub.approvals.some((a) => a.rev === oldRev))
  if (sub && hadApproval) {
    const { decision, ...rest } = sub
    const kept: ApprovalSubmission = decision && decision.outcome !== "approved" ? { ...rest, decision, contentRev: ctx.now } : { ...rest, contentRev: ctx.now }
    next = replaceSubmission(next, sub, kept)
    next = systemNote(next, ctx, postId, "edited_after_approval", actorId, ctx.copy.notes.system.stale(memberName(ctx, actorId)))
    next = log(next, ctx, { kind: "stale", postId, actor: { kind: "user", userId: actorId } })
  }
  if (next.drafts.approved.includes(postId)) {
    next = { ...next, drafts: { ...next.drafts, approved: next.drafts.approved.filter((id) => id !== postId) } }
    next = setReviewState(next, postId, "pending")
    next = log(next, ctx, { kind: "stale", postId, actor: { kind: "user", userId: actorId } })
  }
  return next
}

function newRun(ctx: Ctx, kind: RunKind, input: string, status: Run["status"], extra: Partial<Run> = {}): Run {
  const plan = ctx.copy.plan
  const stages = RUN_AGENTS[kind].stages
  const steps = stages.map((stage, i) => {
    const words = kind === "refine" ? plan.refineStage : (plan.stages[stage] ?? plan.stageFallback)
    const running = status === "running" && i === 0
    return { id: stage, toolName: stage, label: words.label, doneLabel: words.doneLabel, state: running ? ("running" as const) : ("pending" as const), ...(running ? { startedAt: ctx.now } : {}) }
  })
  return {
    id: nextId(ctx, "run"),
    kind,
    agent: RUN_AGENTS[kind].agent,
    input,
    title: plan.titles[kind],
    status,
    steps,
    ...(status === "running" ? { startedAt: ctx.now } : {}),
    ...extra,
  }
}

function startRun(s: EngineState, ctx: Ctx, run: Run): EngineState {
  const started: Run = run.status === "running" ? run : {
    ...run,
    status: "running",
    startedAt: ctx.now,
    steps: run.steps.map((step, i) => (i === 0 ? { ...step, state: "running", startedAt: ctx.now } : { ...step, state: "pending" })),
  }
  const next = upsertRunLog({ ...setRun(s, started), lastEventKind: "run" as const, usage: { ...s.usage, used: s.usage.used + 1 } }, ctx, started)
  return announce(next, ctx.copy.chip.working(1, started.steps.length))
}

function markApproved(s: EngineState, ctx: Ctx, postId: string): EngineState {
  if (s.drafts.approved.includes(postId)) return s
  let next: EngineState = { ...s, drafts: { ...s.drafts, approved: [...s.drafts.approved, postId] } }
  next = setReviewState(next, postId, "approved")
  return log(next, ctx, { kind: "approved", postId })
}

function approveDraftState(s: EngineState, ctx: Ctx, postId: string): EngineState {
  if (s.drafts.approved.includes(postId)) return s
  return persist(markApproved(s, ctx, postId), { kind: "approve", postId })
}

function submitPost(s: EngineState, ctx: Ctx, postId: string): EngineState {
  const post = s.posts[postId]
  if (!post) return s
  let next: EngineState = s
  if (draftPostIds(s).includes(postId) && !next.drafts.submitted.includes(postId)) {
    next = { ...next, drafts: { ...next.drafts, submitted: [...next.drafts.submitted, postId] } }
  }
  if (!openSubmission(next, postId)) {
    const sub: ApprovalSubmission = { postId, submittedBy: ctx.viewer.id, submittedAt: ctx.at, contentRev: post.contentRev, requiredApprovers: 1, approvals: [] }
    next = { ...next, submissions: [...next.submissions, sub] }
    next = systemNote(next, ctx, postId, "submitted", ctx.viewer.id, ctx.copy.notes.system.submitted(memberName(ctx, ctx.viewer.id)))
  }
  next = persist(patchPost(next, postId, { status: "review" }), { kind: "status", postId, status: "review" })
  return log(next, ctx, { kind: "submitted", postId })
}

function allDraftsApproved(s: EngineState): boolean {
  const ids = draftPostIds(s)
  return ids.length > 0 && ids.every((id) => s.drafts.approved.includes(id))
}

function snapshot(s: EngineState, postIds: string[]): NonNullable<GuardrailRequest["prev"]> {
  return Object.fromEntries(
    postIds.flatMap((id) => {
      const post = s.posts[id]
      return post ? [[id, { status: post.status, date: post.scheduledDate, time: post.scheduledTime ?? undefined }]] : []
    }),
  )
}

function upsertRequest(
  s: EngineState,
  ctx: Ctx,
  action: GuardrailAction,
  postIds: string[],
  extra: Partial<Pick<GuardrailRequest, "when" | "to" | "runId" | "localRunId">> = {},
): { state: EngineState; requestId: string } {
  const key = [...postIds].sort().join(",")
  const existing = s.requests.find((r) => r.status === "pending" && r.action === action && [...r.postIds].sort().join(",") === key)
  if (existing) return { state: s, requestId: existing.id }
  const request: GuardrailRequest = { id: nextId(ctx, "req"), action, postIds, status: "pending", requestedAt: ctx.at, prev: snapshot(s, postIds), ...extra }
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

function runIdeas(s: EngineState, ctx: Ctx, set: "first" | "more", input: string): EngineState {
  const next = startRun({ ...s, ideaSet: set }, ctx, newRun(ctx, "ideas", input, "running"))
  return showCard(next, directionsCard(next, set), "streaming")
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

function intentPlan(s: EngineState, ctx: Ctx, input: string, needsDrafts: boolean): EngineState {
  const run = newRun(ctx, "plan", input, "proposed")
  const text = needsDrafts ? ctx.copy.reply.scheduleNeedsDrafts : ctx.copy.reply.planProposed
  return say({ ...setRun(s, run) }, ctx, text, [{ kind: "plan", runId: run.id }])
}

function briefInput(s: EngineState, ctx: Ctx): string {
  const b = s.brief
  const card = ctx.copy.cards.brief
  const idea = s.chosenIdeaId ? s.ideas[s.chosenIdeaId] : undefined
  return [idea?.summary || b.campaignName, card.objectives[b.objective], card.channels[b.channels], card.volume[b.volume], b.startDate].filter(Boolean).join(". ")
}

function intentCreate(s: EngineState, ctx: Ctx, fromCard: boolean, input: string): EngineState {
  const text = fromCard ? briefInput(s, ctx) : input
  if (!text.trim()) return s
  const run = newRun(ctx, "create", text, "running")
  const attachment: TranscriptAttachment = { kind: "plan", runId: run.id }
  let next = fromCard ? userLine(s, ctx, ctx.copy.reply.createUser, { attachments: [attachment] }) : attachToLastUser(s, attachment)
  next = { ...next, drafts: { visible: true, ids: [], approved: [], submitted: [] } }
  next = showCard(next, { kind: "drafts", activeIndex: 0 }, "streaming")
  return startRun(next, ctx, run)
}

function intentDrafts(s: EngineState, ctx: Ctx): EngineState {
  const card: CanvasCard = { kind: "drafts", activeIndex: s.canvas.card?.kind === "drafts" ? s.canvas.card.activeIndex : 0 }
  return showCard(say(s, ctx, ctx.copy.reply.created, [cardLink(card)]), card, allDraftsApproved(s) ? "done" : "needs_you")
}

function intentTighten(s: EngineState, ctx: Ctx, postId: string | null, input: string): EngineState {
  const target = postId ?? activeDraftId(s) ?? contextPostId(s)
  const post = target ? s.posts[target] : undefined
  if (!target || !post) return say(s, ctx, ctx.copy.reply.whichPost)
  const prompt = `${ctx.copy.prompts.refine("shorter", target, post.blurb || post.brief || "")} ${input}`.trim()
  return startRun(s, ctx, newRun(ctx, "refine", prompt, "running", { postId: target, refine: "shorter" }))
}

function pendingScheduleRequest(s: EngineState): GuardrailRequest | undefined {
  return [...s.requests].reverse().find((r) => r.action === "schedule" && r.status === "pending")
}

function defaultSlots(s: EngineState): ScheduleSlot[] {
  let day = addDays(todayIso(), 1)
  return draftPostIds(s).map((postId) => {
    const post = s.posts[postId]
    const date = post.scheduledDate && post.scheduledDate > todayIso() ? post.scheduledDate : day
    day = addDays(date, 2)
    return { postId, date, time: post.scheduledTime || DEFAULT_TIME, channel: primaryChannel(post) }
  })
}

function intentSchedule(s: EngineState, ctx: Ctx): EngineState {
  const hits = matchPosts(s, lastUserText(s))
  if (hits.length > 1) return say(s, ctx, ctx.copy.reply.whichPost)
  if (hits.length === 1) return intentGuardrail(s, ctx, "schedule")
  if (!s.drafts.visible || draftPostIds(s).length === 0) return intentPlan(s, ctx, lastUserText(s), true)
  const pending = pendingScheduleRequest(s)
  const card: CanvasCard = pending ? { kind: "schedule", requestId: pending.id } : { kind: "schedule" }
  const schedule = s.schedule.length ? s.schedule : defaultSlots(s)
  return showCard(say({ ...s, schedule, pendingOffer: null }, ctx, ctx.copy.reply.schedule, [cardLink(card)]), card, pending ? "needs_you" : "ready")
}

function intentApprovals(s: EngineState, ctx: Ctx): EngineState {
  const card: CanvasCard = { kind: "approvals_queue" }
  return showCard(say(s, ctx, ctx.copy.reply.approvals, [cardLink(card)]), card, queueStatus(s, ctx))
}

function rescheduleTarget(s: EngineState, text: string): { date: string; time?: string } | null {
  const days = dayMentions(text)
  const day = days.length > 1 ? days[days.length - 1] : /\b(to|for)\b/.test(text.toLowerCase()) ? days[0] : undefined
  const time = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
  if (day === undefined && !time) return null
  const base = mondayOf(todayIso())
  const date = day === undefined ? null : addDays(base, (day + 6) % 7)
  return { date: date ?? "", ...(time ? { time: `${time[1].padStart(2, "0")}:${time[2]}` } : {}) }
}

function intentGuardrail(s: EngineState, ctx: Ctx, action: GuardrailAction): EngineState {
  const reply = ctx.copy.reply
  const text = lastUserText(s)
  if (action === "bulk_approve") {
    const ids = draftPostIds(s)
    const pool = ids.length ? ids : Object.values(s.posts).filter((p) => p.agentMeta?.reviewState === "pending").map((p) => p.id)
    const undecided = pool.filter((id) => !s.drafts.approved.includes(id) && !s.drafts.submitted.includes(id))
    if (undecided.length === 0) return say(s, ctx, reply.whichPost)
    const { state, requestId } = upsertRequest(s, ctx, action, undecided)
    return say(state, ctx, reply.guardrailBulk, [{ kind: "approval", requestId }])
  }
  const hits = matchPosts(s, text)
  const fallback = activeDraftId(s) ?? contextPostId(s)
  const target = hits.length === 1 ? hits[0].id : hits.length === 0 ? fallback : null
  if (!target) return say(s, ctx, reply.whichPost)
  if (action === "reschedule" || action === "schedule") {
    const post = s.posts[target]
    const to = rescheduleTarget(s, text)
    if (!to) return say(s, ctx, reply.whenTo(postTitle(s, target)))
    const date = to.date || post.scheduledDate
    const time = to.time ?? post.scheduledTime ?? DEFAULT_TIME
    const when = formatWhen(date, time)
    const { state, requestId } = upsertRequest(s, ctx, action, [target], { when, to: { date, time } })
    return say(state, ctx, reply.reschedule(postTitle(s, target), when), [{ kind: "approval", requestId }])
  }
  const { state, requestId } = upsertRequest(s, ctx, action, [target])
  return say(state, ctx, action === "publish" ? reply.guardrailPublish : reply.guardrailDelete, [{ kind: "approval", requestId }])
}

function intentPostContext(s: EngineState, ctx: Ctx, input: string): EngineState {
  const postId = contextPostId(s)
  if (!postId) return intentFallback(s, ctx, input)
  const card: CanvasCard = { kind: "current_item", postId, origin: "context" }
  const next = showCard(s, card, "ready")
  return startRun(next, ctx, newRun(ctx, "advice", ctx.copy.prompts.advice(postId, postTitle(s, postId), input), "running", { postId }))
}

function intentFallback(s: EngineState, ctx: Ctx, input: string): EngineState {
  return startRun(s, ctx, newRun(ctx, "chat", input, "running"))
}

function applyIntent(s: EngineState, ctx: Ctx, intent: Intent, input: string): EngineState {
  switch (intent) {
    case "ideas":
      return runIdeas(s, ctx, "first", input)
    case "more_ideas":
      return runIdeas(s, ctx, "more", input)
    case "compare":
      return intentCompare(s, ctx)
    case "plan":
      return intentPlan(s, ctx, input, false)
    case "create":
      return intentCreate(s, ctx, false, input)
    case "drafts":
      return intentDrafts(s, ctx)
    case "tighten":
      return intentTighten(s, ctx, null, input)
    case "schedule":
      return intentSchedule(s, ctx)
    case "approvals":
      return intentApprovals(s, ctx)
    case "post_context":
      return intentPostContext(s, ctx, input)
    case "fallback":
      return intentFallback(s, ctx, input)
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
  return applyIntent(s, ctx, routeIntent(text, routerContext(s)), text)
}

function userSent(s: EngineState, ctx: Ctx, text: string, source: "typed" | "voice" | "chip"): EngineState {
  let next: EngineState = { ...s, lastEventKind: "user" }
  if (next.usage.used >= next.usage.limit) {
    next = userLine(next, ctx, text, { source })
    return say(next, ctx, ctx.copy.reply.cap(next.usage.limit, monthStartLabel(ctx.now)), [{ kind: "cap" }])
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

function runStage(s: EngineState, ctx: Ctx, runId: string, agent: string): EngineState {
  const run = findRun(s, runId)
  if (!run || (run.status !== "running" && run.status !== "needs_you")) return s
  const at = run.steps.findIndex((step) => step.id === agent)
  if (at < 0 || run.steps[at].state === "running") return s
  const steps = run.steps.map((step, k) => {
    if (k < at && step.state !== "done") return { ...step, state: "done" as const, finishedAt: ctx.now }
    if (k === at) return { ...step, state: "running" as const, startedAt: ctx.now }
    return step
  })
  const next = upsertRunLog(setRun(s, { ...run, status: "running", steps }), ctx, { ...run, status: "running", steps })
  return announce({ ...next, lastEventKind: "run" }, ctx.copy.chip.working(at + 1, steps.length))
}

function runPost(s: EngineState, runId: string, postId: string): EngineState {
  const run = findRun(s, runId)
  if (!run || run.postIds?.includes(postId)) return s
  let next = setRun(s, { ...run, postIds: [...(run.postIds ?? []), postId] })
  if (run.kind === "create" && !next.drafts.ids.includes(postId)) {
    next = { ...next, drafts: { ...next.drafts, visible: true, ids: [...next.drafts.ids, postId] } }
  }
  return next
}

function endStream(s: EngineState): EngineState {
  const last = s.transcript[s.transcript.length - 1]
  return last?.streaming ? { ...s, transcript: [...s.transcript.slice(0, -1), { ...last, streaming: false }] } : s
}

function finishSteps(run: Run, now: number): Run["steps"] {
  return run.steps.map((step) => (step.state === "running" || step.state === "pending" ? { ...step, state: "done" as const, finishedAt: now } : step))
}

function runDone(input: EngineState, ctx: Ctx, runId: string): EngineState {
  const s = endStream(input)
  const run = findRun(s, runId)
  if (!run || run.status !== "running") return s
  const gate = s.requests.find((r) => r.localRunId === runId && r.status === "pending")
  if (gate) {
    const steps = run.steps.map((step) => (step.id === "human-gate" ? { ...step, state: "running" as const } : step.state === "running" ? { ...step, state: "done" as const, finishedAt: ctx.now } : step))
    return setCanvasStatus(setRun(s, { ...run, status: "needs_you", steps }), "needs_you")
  }
  const done: Run = { ...run, status: "done", finishedAt: ctx.now, steps: finishSteps(run, ctx.now) }
  let next = upsertRunLog(setRun(s, done), ctx, done)
  next = announce({ ...next, lastEventKind: "run" }, ctx.copy.plan.done(done.steps.length))
  if (run.kind === "ideas" || run.kind === "plan") {
    const card = directionsCard(next, next.ideaSet)
    const ids = ideaList(next, next.ideaSet)
    const text = ids.length === 0 ? ctx.copy.cards.directions.empty : next.ideaSet === "more" ? ctx.copy.reply.moreIdeas : ctx.copy.reply.ideas
    next = showCard(say(next, ctx, text, [cardLink(card)]), card, ids.length ? "ready" : "empty")
  } else if (run.kind === "create") {
    const ids = draftPostIds(next)
    const card: CanvasCard = { kind: "drafts", activeIndex: 0 }
    next = ids.length
      ? showCard(say(next, ctx, ctx.copy.reply.createdCount(ids.length), [cardLink(card)]), card, "needs_you")
      : showCard(next, card, "empty")
    if (ids.length) next = log(next, ctx, { kind: "drafted", count: ids.length, actor: { kind: "assistant" } })
    if (s.requests.some((r) => r.localRunId === runId && r.status === "approved")) next = stageDone(next, ctx, run.postIds ?? [])
  } else if (run.kind === "refine" && run.postId) {
    next = { ...next, deck: { ...next.deck, refining: null } }
    next = announce(next, run.refine === "new_image" ? ctx.copy.mobile.deck.imageUpdated : ctx.copy.mobile.deck.captionUpdated)
  }
  return drainQueue(next, ctx)
}

function runFailed(input: EngineState, ctx: Ctx, runId: string, error: string): EngineState {
  const s = endStream(input)
  const run = findRun(s, runId)
  if (!run || (run.status !== "running" && run.status !== "needs_you")) return s
  const at = Math.max(0, run.steps.findIndex((step) => step.state === "running"))
  const steps = run.steps.map((step, k) => (k === at ? { ...step, state: "failed" as const, error, finishedAt: ctx.now } : step))
  let next = setRun(s, { ...run, status: "error", error, steps })
  next = { ...next, deck: { ...next.deck, refining: null }, lastEventKind: "run" }
  if (next.canvas.status === "streaming") next = setCanvasStatus(next, "error")
  next = say(next, ctx, ctx.copy.reply.error, [{ kind: "error", runId }])
  next = effect(next, { type: "announce", message: ctx.copy.reply.error, assertive: true })
  return log(next, ctx, { kind: "run", runId, steps, actor: { kind: "assistant" } })
}

function runStop(input: EngineState, ctx: Ctx): EngineState {
  const s = endStream(input)
  const run = s.run
  if (!run || (run.status !== "running" && run.status !== "needs_you")) return s
  const steps = run.steps.map((step) => (step.state === "running" || step.state === "pending" ? { ...step, state: "cancelled" as const } : step))
  let next = setRun(s, { ...run, status: "cancelled", steps, finishedAt: ctx.now })
  next = say({ ...next, deck: { ...next.deck, refining: null } }, ctx, ctx.copy.reply.stopped)
  if (run.kind === "create") {
    const wrote = draftPostIds(next).length > 0
    return showCard(next, wrote ? { kind: "drafts", activeIndex: 0 } : { kind: "brief" }, "ready")
  }
  return drainQueue(setCanvasStatus(next, next.canvas.status === "streaming" ? "ready" : next.canvas.status), ctx)
}

function retry(s: EngineState, ctx: Ctx): EngineState {
  const run = s.run
  if (!run || run.status !== "error") return s
  const fresh = newRun(ctx, run.kind, run.input, "running", { postId: run.postId, refine: run.refine })
  let next = setCanvasStatus(s, s.canvas.card ? "streaming" : s.canvas.status)
  next = say(next, ctx, ctx.copy.reply.retryAck, [{ kind: "plan", runId: fresh.id }])
  return startRun(next, ctx, fresh)
}

function build(s: EngineState, ctx: Ctx, ideaId: string): EngineState {
  if (!ideaId) return s
  let next: EngineState = { ...s, chosenIdeaId: ideaId, brief: { ...s.brief, campaignName: briefName(s, ideaId), startDate: s.brief.startDate || addDays(todayIso(), 1) } }
  next = userLine(next, ctx, ctx.copy.reply.buildUser)
  const card: CanvasCard = { kind: "brief" }
  return showCard(say(next, ctx, ctx.copy.reply.build, [cardLink(card)]), card, "ready")
}

function draftsApprove(s: EngineState, ctx: Ctx, postId: string): EngineState {
  if (!isApproverRole(ctx.env.role) || s.drafts.approved.includes(postId)) return s
  let next = approveDraftState(s, ctx, postId)
  const n = Math.max(1, draftPostIds(s).indexOf(postId) + 1)
  next = effect(next, { type: "toast", id: `approve-${postId}`, message: ctx.copy.cards.drafts.approvedToast(n), undo: { type: "card_action", action: { card: "drafts", kind: "undo_approve", postId } } })
  if (allDraftsApproved(next)) {
    next = say({ ...next, pendingOffer: "schedule" }, ctx, ctx.copy.reply.approvedAllCount(draftPostIds(next).length))
    return next.canvas.card?.kind === "drafts" ? setCanvasStatus(next, "done") : next
  }
  return say(next, ctx, ctx.copy.reply.approvedOne)
}

function draftsUndoApprove(s: EngineState, ctx: Ctx, postId: string): EngineState {
  if (!s.drafts.approved.includes(postId)) return s
  let next: EngineState = { ...s, drafts: { ...s.drafts, approved: s.drafts.approved.filter((id) => id !== postId) } }
  next = persist(setReviewState(next, postId, "pending"), { kind: "unapprove", postId })
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
      if (action.kind === "build") return build(s, ctx, current?.selectedId ?? s.chosenIdeaId ?? ideaList(s, s.ideaSet)[0] ?? "")
      if (action.kind === "compare") return intentCompare(s, ctx)
      return runIdeas(s, ctx, "more", copy.reply.moreUser)
    }
    case "recommendation": {
      if (action.kind === "keep_exploring") return showCard(s, directionsCard(s, s.ideaSet), "ready")
      const ideaId = s.canvas.card?.kind === "recommendation" ? s.canvas.card.ideaId : (s.chosenIdeaId ?? "")
      return build(s, ctx, ideaId)
    }
    case "brief": {
      if (action.kind === "edit") return { ...s, brief: { ...s.brief, ...action.patch } }
      if (action.kind === "create") return intentCreate(s, ctx, true, "")
      return runIdeas(say(s, ctx, copy.reply.debateBrief), ctx, "first", copy.reply.debateInput(s.brief.campaignName))
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
          return intentTighten(s, ctx, action.postId, "")
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
      const { state, requestId } = upsertRequest(next, ctx, "schedule", s.schedule.map((slot) => slot.postId))
      next = say(state, ctx, copy.reply.approvalAsk, [{ kind: "approval", requestId }])
      return showCard(next, { kind: "schedule", requestId }, "needs_you")
    }
    case "handoff":
      if (action.kind === "open_calendar") {
        const first = s.staged[0]?.date ?? (contextPostId(s) ? s.posts[contextPostId(s) ?? ""]?.scheduledDate : undefined)
        return effect(s, { type: "navigate", view: "interface", ...(first ? { week: weekOf(first) } : {}) })
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
        return effect(s, { type: "navigate", view: "interface", ...(post?.scheduledDate ? { week: weekOf(post.scheduledDate) } : {}), post: postId })
      }
      const next = applyCaption(s, ctx, postId, action.blurb, ctx.viewer.id)
      return say(effect(next, { type: "toast", id: `caption-${postId}`, message: copy.cards.current.applied }), ctx, copy.reply.appliedEdit)
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

function stageDone(s: EngineState, ctx: Ctx, postIds: string[]): EngineState {
  const staged = postIds.flatMap((postId) => {
    const post = s.posts[postId]
    return post?.scheduledDate ? [{ postId, date: post.scheduledDate, time: post.scheduledTime || DEFAULT_TIME, channel: primaryChannel(post) }] : []
  })
  const card: CanvasCard = { kind: "handoff" }
  const next = showCard(say({ ...s, staged }, ctx, ctx.copy.reply.staged, [cardLink(card)]), card, "ready")
  return log(next, ctx, { kind: "staged", count: staged.length, actor: { kind: "assistant" } })
}

function stageSlots(s: EngineState, ctx: Ctx, request: GuardrailRequest): EngineState {
  let next = s
  for (const slot of s.schedule.filter((item) => request.postIds.includes(item.postId))) {
    next = patchPost(next, slot.postId, { scheduledDate: slot.date, scheduledTime: slot.time, status: "review" })
    next = persist(next, { kind: "move", postId: slot.postId, date: slot.date, time: slot.time })
    next = persist(next, { kind: "status", postId: slot.postId, status: "review" })
  }
  return stageDone(next, ctx, request.postIds)
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
    let next = patchRequest(s, request.id, { status: "submitted", resolvedAt: ctx.at })
    for (const postId of request.postIds) next = submitPost(next, ctx, postId)
    return say(next, ctx, copy.reply.stagedContributor)
  }
  let next = patchRequest(s, request.id, { status: "approved", resolvedAt: ctx.at })
  next = log(next, ctx, { kind: "request_approved" })
  next = effect(next, {
    type: "toast",
    id: request.id,
    message: copy.approval.approvedToast(verbFor(copy, request)),
    ...(request.action === "delete" ? {} : { undo: { type: "request_undo" as const, requestId: request.id } }),
  })
  switch (request.action) {
    case "schedule": {
      const run = request.localRunId ? findRun(next, request.localRunId) : undefined
      if (run && request.runId) return setCanvasStatus(setRun(next, { ...run, status: "running" }), "streaming")
      if (request.to?.date) {
        for (const postId of request.postIds) {
          next = patchPost(next, postId, { scheduledDate: request.to.date, scheduledTime: request.to.time, status: "scheduled" })
          next = persist(next, { kind: "move", postId, date: request.to.date, time: request.to.time })
          next = persist(next, { kind: "status", postId, status: "scheduled" })
        }
        return next
      }
      return stageSlots(next, ctx, request)
    }
    case "reschedule": {
      const to = request.to
      if (!to) return next
      for (const postId of request.postIds) {
        next = patchPost(next, postId, { scheduledDate: to.date, scheduledTime: to.time })
        next = persist(next, { kind: "move", postId, date: to.date, time: to.time })
      }
      return next
    }
    case "bulk_approve":
      for (const postId of request.postIds) next = markApproved(next, ctx, postId)
      return persist(next, { kind: "bulk_approve", postIds: request.postIds })
    case "publish":
      for (const postId of request.postIds) next = persist(patchPost(next, postId, { status: "scheduled", scheduledDate: todayIso() }), { kind: "publish", postId })
      return next
    case "delete":
      for (const postId of request.postIds) {
        const posts = { ...next.posts }
        delete posts[postId]
        next = {
          ...next,
          posts,
          drafts: { ...next.drafts, ids: next.drafts.ids.filter((id) => id !== postId), approved: next.drafts.approved.filter((id) => id !== postId) },
        }
        next = persist(next, { kind: "delete", postId })
      }
      return next
  }
}

function requestUndo(s: EngineState, ctx: Ctx, requestId: string): EngineState {
  const request = s.requests.find((r) => r.id === requestId)
  if (!request || request.status !== "approved" || request.runId || request.action === "delete") return s
  let next = patchRequest(s, request.id, { status: "pending", resolvedAt: undefined })
  next = log(next, ctx, { kind: "undone" })
  for (const postId of request.postIds) {
    const prev = request.prev?.[postId]
    if (request.action === "bulk_approve") {
      next = { ...next, drafts: { ...next.drafts, approved: next.drafts.approved.filter((id) => id !== postId) } }
      next = persist(setReviewState(next, postId, "pending"), { kind: "unapprove", postId })
      continue
    }
    if (!prev) continue
    if (request.action === "schedule" || request.action === "reschedule" || request.action === "publish") {
      next = patchPost(next, postId, { scheduledDate: prev.date, scheduledTime: prev.time })
      next = persist(next, { kind: "move", postId, date: prev.date, time: prev.time })
    }
    if (request.action !== "reschedule") {
      next = persist(patchPost(next, postId, { status: prev.status }), { kind: "status", postId, status: prev.status })
    }
  }
  if (request.action === "schedule") {
    next = showCard({ ...next, staged: [] }, { kind: "schedule", requestId: request.id }, "needs_you")
    return say(next, ctx, ctx.copy.reply.undoneSchedule)
  }
  return say(next, ctx, ctx.copy.approval.undone)
}

function eligibleApproverCount(ctx: Ctx, submittedBy: string): number {
  return ctx.env.team.filter((m) => isApproverRole(m.role) && m.id !== submittedBy).length
}

function submissionDecided(s: EngineState, ctx: Ctx, event: Extract<EngineEvent, { type: "submission_decided" }>): EngineState {
  const sub = openSubmission(s, event.postId)
  const post = s.posts[event.postId]
  if (!sub || !post || !isApproverRole(ctx.env.role) || sub.submittedBy === ctx.viewer.id) return s
  const viewerName = memberName(ctx, ctx.viewer.id)
  if (event.outcome === "sent_back") {
    if (!event.reason) return s
    const line = ctx.copy.notes.system.sentBack(viewerName, REJECT_REASON_LABELS[event.reason])
    let next = replaceSubmission(s, sub, { ...sub, decision: { by: ctx.viewer.id, at: ctx.at, outcome: "sent_back", reason: event.reason, ...(event.note ? { note: event.note } : {}) } })
    next = persist(patchPost(next, event.postId, { status: "brief" }), { kind: "status", postId: event.postId, status: "brief" })
    next = systemNote(next, ctx, event.postId, "sent_back", ctx.viewer.id, line, { reason: event.reason, ...(event.note ? { detail: event.note } : {}) })
    next = persist(next, { kind: "note_add", postId: event.postId, localId: "", body: event.note ? `${line} ${event.note}` : line, mentions: [] })
    next = log(next, ctx, { kind: "sent_back", postId: event.postId })
    const isCurrent = next.canvas.card?.kind === "current_item" && next.canvas.card.postId === event.postId
    return isCurrent ? say(next, ctx, ctx.copy.reply.sentBack(postTitle(next, event.postId))) : next
  }
  if (sub.approvals.some((a) => a.by === ctx.viewer.id && a.rev === post.contentRev)) return s
  const request: GuardrailRequest = { id: nextId(ctx, "req"), action: "schedule", postIds: [event.postId], status: "approved", requestedAt: ctx.at, resolvedAt: ctx.at }
  let next: EngineState = { ...s, requests: [...s.requests, request] }
  const approvals = [...sub.approvals, { by: ctx.viewer.id, at: ctx.at, rev: post.contentRev }]
  const current = approvals.filter((a) => a.rev === post.contentRev).length
  const needed = Math.min(sub.requiredApprovers, eligibleApproverCount(ctx, sub.submittedBy))
  const complete = current >= needed
  next = replaceSubmission(next, sub, { ...sub, approvals, ...(complete ? { decision: { by: ctx.viewer.id, at: ctx.at, outcome: "approved" as const } } : {}) })
  if (complete) next = persist(patchPost(next, event.postId, { status: "scheduled" }), { kind: "status", postId: event.postId, status: "scheduled" })
  next = systemNote(next, ctx, event.postId, "approved", ctx.viewer.id, ctx.copy.notes.system.approved(viewerName))
  next = log(next, ctx, { kind: "approved", postId: event.postId })
  return log(next, ctx, { kind: "request_approved", postId: event.postId })
}

function submissionWithdrawn(s: EngineState, ctx: Ctx, postId: string): EngineState {
  const sub = openSubmission(s, postId)
  if (!sub || sub.submittedBy !== ctx.viewer.id) return s
  let next = replaceSubmission(s, sub, null)
  next = persist(patchPost(next, postId, { status: "brief" }), { kind: "status", postId, status: "brief" })
  if (next.drafts.submitted.includes(postId)) next = { ...next, drafts: { ...next.drafts, submitted: next.drafts.submitted.filter((id) => id !== postId) } }
  next = systemNote(next, ctx, postId, "withdrawn", ctx.viewer.id, ctx.copy.approve.withdrawn)
  return log(next, ctx, { kind: "withdrawn", postId })
}

function deckDecide(s: EngineState, ctx: Ctx, postId: string, outcome: "approved" | "skipped" | "submitted"): EngineState {
  const copy = ctx.copy
  const deck = s.deck
  if (deck.order[deck.index] !== postId) return s
  if (outcome === "skipped") {
    const skippedBefore = deck.decisions.some((d) => d.postId === postId && d.outcome === "skipped")
    const decisions = [...deck.decisions, { postId, outcome }]
    const skippedPostIds = s.skippedPostIds.includes(postId) ? s.skippedPostIds : [...s.skippedPostIds, postId]
    const order = skippedBefore ? deck.order : [...deck.order.filter((id) => id !== postId), postId]
    const index = skippedBefore ? deck.index + 1 : deck.index
    return persist({ ...s, skippedPostIds, deck: { ...deck, decisions, order, index } }, { kind: "deck_skips", postIds: skippedPostIds })
  }
  const contributor = ctx.env.role === "contributor"
  const finalOutcome = contributor || outcome === "submitted" ? "submitted" : "approved"
  let next = s
  if (finalOutcome === "submitted") {
    if (!contributor) return s
    next = submitPost(next, ctx, postId)
  } else {
    next = log(persist(setReviewState(next, postId, "approved"), { kind: "approve", postId }), ctx, { kind: "approved", postId })
  }
  next = { ...next, deck: { ...next.deck, decisions: [...next.deck.decisions, { postId, outcome: finalOutcome }], index: next.deck.index + 1 } }
  const message = finalOutcome === "approved" ? copy.mobile.deck.approvedToast : copy.approval.submitted
  return effect(next, { type: "toast", id: `deck-${postId}`, message, undo: { type: "deck_undo" }, position: "top-center" })
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
      next = { ...next, skippedPostIds: next.skippedPostIds.filter((id) => id !== last.postId) }
    } else {
      index = order.indexOf(last.postId)
    }
  } else {
    index = order.indexOf(last.postId)
    if (last.outcome === "approved") {
      next = persist(setReviewState(next, last.postId, "pending"), { kind: "unapprove", postId: last.postId })
    } else {
      const sub = openSubmission(next, last.postId)
      if (sub && sub.submittedBy === ctx.viewer.id) next = replaceSubmission(next, sub, null)
      const prev = s.posts[last.postId]?.agentMeta ? "idea" : "brief"
      next = persist(patchPost(next, last.postId, { status: prev }), { kind: "status", postId: last.postId, status: prev })
    }
    next = log(next, ctx, { kind: "undone", postId: last.postId })
  }
  const done = { ...next, deck: { ...next.deck, decisions: rest, order, index: Math.max(0, index) } }
  return last.outcome === "skipped" ? persist(done, { kind: "deck_skips", postIds: done.skippedPostIds }) : done
}

function deckReviewSkipped(s: EngineState): EngineState {
  const decided = new Set(s.deck.decisions.filter((d) => d.outcome !== "skipped").map((d) => d.postId))
  const skipped = [...new Set(s.deck.decisions.filter((d) => d.outcome === "skipped").map((d) => d.postId))].filter((id) => !decided.has(id))
  return { ...s, deck: { order: skipped, index: 0, decisions: [], refining: null } }
}

function deckRefine(s: EngineState, ctx: Ctx, postId: string, kind: RefineKind): EngineState {
  if (s.deck.refining || !s.posts[postId] || s.run?.status === "running") return s
  const post = s.posts[postId]
  const input = ctx.copy.prompts.refine(kind, postId, post.blurb || post.brief || "")
  return startRun({ ...s, deck: { ...s.deck, refining: { postId, kind } } }, ctx, newRun(ctx, "refine", input, "running", { postId, refine: kind }))
}

function handoffIn(s: EngineState, ctx: Ctx, carry: "chat" | "chat_and_item" | "none"): EngineState {
  let next = s
  if (carry !== "none") {
    const moved = s.miniChat.filter((e) => e.id !== MINI_INITIAL_ID)
    const hadUser = moved.some((e) => e.role === "user")
    if (moved.length > 0) {
      const divider: TranscriptEntry = { id: nextId(ctx, "m"), role: "system", divider: "handoff", createdAt: ctx.now }
      next = { ...next, transcript: [...next.transcript, divider, ...moved], miniChat: [initialMini(ctx.copy, ctx.now)] }
    }
    const postId = s.context.kind === "post" ? s.context.postId : null
    if (carry === "chat_and_item" && postId && next.posts[postId]) {
      const card: CanvasCard = { kind: "current_item", postId, origin: "handoff" }
      next = showCard(say(next, ctx, ctx.copy.reply.handoffIn(postTitle(next, postId)), [cardLink(card)]), card, "ready")
    } else if (hadUser) {
      next = say(next, ctx, ctx.copy.reply.handoffInChat)
    }
  }
  return effect(next, { type: "focus_composer" })
}

function showCardEvent(s: EngineState, card: CanvasCard): EngineState {
  const current = s.canvas.card
  if (current && current.kind === card.kind) return effect({ ...s, canvas: { ...s.canvas, visibility: "shown" } }, { type: "canvas_shown" })
  return showCard(s, card, "done")
}

function noteEdit(s: EngineState, ctx: Ctx, noteId: string, body: string | null): EngineState {
  const note = s.notes.find((n) => n.id === noteId)
  if (!note || note.authorId !== ctx.viewer.id || note.kind !== "note") return s
  if (body === null) return persist({ ...s, notes: s.notes.filter((n) => n.id !== noteId) }, { kind: "note_delete", postId: note.postId, noteId })
  const { annotations, mentionUserIds } = extractMentions(body, ctx.env.team)
  const notes = s.notes.map((n) => (n.id === noteId ? { ...n, body, editedAt: ctx.at, updatedAt: ctx.at, annotations, mentionUserIds } : n))
  return persist({ ...s, notes }, { kind: "note_edit", postId: note.postId, noteId, body, mentions: mentionUserIds })
}

function noteReact(s: EngineState, ctx: Ctx, noteId: string, emoji: PrototypeNote["reactions"][number]["emoji"]): EngineState {
  const viewer = ctx.viewer.id
  const target = s.notes.find((n) => n.id === noteId)
  if (!target) return s
  const notes = s.notes.map((n) => {
    if (n.id !== noteId) return n
    const existing = n.reactions.find((r) => r.emoji === emoji)
    if (!existing) return { ...n, reactions: [...n.reactions, { emoji, userIds: [viewer] }] }
    const userIds = existing.userIds.includes(viewer) ? existing.userIds.filter((id) => id !== viewer) : [...existing.userIds, viewer]
    const reactions = userIds.length ? n.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds } : r)) : n.reactions.filter((r) => r.emoji !== emoji)
    return { ...n, reactions }
  })
  return persist({ ...s, notes }, { kind: "note_react", postId: target.postId, noteId, emoji })
}

function threadRead(s: EngineState, ctx: Ctx, postId: string): EngineState {
  const current = s.reads.find((r) => r.postId === postId && r.userId === ctx.viewer.id)
  if (current && unreadFor(s.notes, s.reads, postId, ctx.viewer.id).count === 0) return s
  const reads = current
    ? s.reads.map((r) => (r === current ? { ...r, lastReadAt: ctx.at } : r))
    : [...s.reads, { postId, userId: ctx.viewer.id, lastReadAt: ctx.at }]
  return persist({ ...s, reads }, { kind: "read", postId })
}

function hydratePosts(s: EngineState, ctx: Ctx, incoming: Record<string, PrototypePost>): EngineState {
  const posts = { ...incoming }
  for (const [id, prev] of Object.entries(s.posts)) {
    const fresh = posts[id]
    if (fresh && prev.contentRev > fresh.contentRev) posts[id] = prev
    else if (!fresh && (s.drafts.ids.includes(id) || s.run?.postIds?.includes(id))) posts[id] = prev
  }
  const pending = Object.values(posts)
    .filter((post) => post.agentMeta?.reviewState === "pending" || post.status === "review")
    .map((post) => post.id)
    .sort(byDate({ ...s, posts }))
  const skipped = new Set(s.skippedPostIds)
  const deckOrder = [...pending.filter((id) => !skipped.has(id)), ...pending.filter((id) => skipped.has(id))]
  const contributors = new Set(ctx.env.team.filter((m) => m.role === "contributor").map((m) => m.id))
  const known = new Set(s.submissions.map((sub) => sub.postId))
  const derived: ApprovalSubmission[] = Object.values(posts)
    .filter((post) => post.status === "review" && post.leadUserId && contributors.has(post.leadUserId) && !known.has(post.id))
    .map((post) => ({ postId: post.id, submittedBy: post.leadUserId as string, submittedAt: post.updatedAt ?? ctx.at, contentRev: post.contentRev, requiredApprovers: 1, approvals: [] }))
  return {
    ...s,
    posts,
    submissions: derived.length ? [...s.submissions, ...derived] : s.submissions,
    deck: s.deck.order.length || s.deck.decisions.length ? s.deck : { ...s.deck, order: deckOrder },
  }
}

export function reduce(state: EngineState, event: EngineInput): EngineState {
  const { env } = event
  const seq = state.seq + 1
  const now = Math.max(event.now, state.clock + 1)
  const ctx: Ctx = { env, copy: copyFor(env.assistantName), viewer: { id: env.viewerId, role: env.role }, seq, now, at: new Date(now).toISOString(), counter: { n: 0 } }
  const s: EngineState = { ...state, seq, clock: now }
  const user: EngineState = { ...s, lastEventKind: "user" }
  switch (event.type) {
    case "user_sent":
      return userSent(s, ctx, event.text, event.source)
    case "queue_removed": {
      const text = s.queue[event.index]
      if (text === undefined) return s
      let dropped = false
      const transcript = s.transcript.filter((entry) => {
        if (!dropped && entry.queued && entry.text === text) {
          dropped = true
          return false
        }
        return true
      })
      return { ...s, queue: s.queue.filter((_, index) => index !== event.index), transcript }
    }
    case "new_mini_chat":
      return { ...s, miniChat: [initialMini(ctx.copy, now), { id: nextId(ctx, "m"), role: "assistant", text: ctx.copy.flyout.newChat, createdAt: now }] }
    case "card_action":
      return cardAction(user, ctx, event.action)
    case "run_start": {
      const run = s.run
      if (!run || run.status !== "proposed") return s
      return startRun(user, ctx, run)
    }
    case "run_revise": {
      const run = s.run
      if (!run || run.status !== "proposed") return s
      return effect(say({ ...user, composerDraft: `${run.input}: ` }, ctx, ctx.copy.reply.reviseAck), { type: "focus_composer" })
    }
    case "run_stop":
      return runStop(user, ctx)
    case "retry":
      return retry(user, ctx)
    case "run_stage":
      return runStage(s, ctx, event.runId, event.agent)
    case "run_post":
      return runPost(s, event.runId, event.postId)
    case "run_server": {
      const run = findRun(s, event.runId)
      return run ? setRun(s, { ...run, serverRunId: event.serverRunId }) : s
    }
    case "run_done":
      return runDone(s, ctx, event.runId)
    case "run_failed":
      return runFailed(s, ctx, event.runId, event.error)
    case "request_resolved":
      return requestResolved(user, ctx, event)
    case "request_undo":
      return requestUndo(user, ctx, event.requestId)
    case "caption_edited":
      return applyCaption(user, ctx, event.postId, event.blurb, ctx.viewer.id)
    case "note_added": {
      const { annotations, mentionUserIds } = extractMentions(event.body, env.team)
      const { state: added, id } = addNote(user, ctx, { postId: event.postId, authorId: ctx.viewer.id, body: event.body, annotations, mentionUserIds })
      const next = persist(added, { kind: "note_add", postId: event.postId, localId: id, body: event.body, mentions: mentionUserIds })
      return log(next, ctx, { kind: "note", postId: event.postId })
    }
    case "note_saved":
      return { ...s, notes: s.notes.map((n) => (n.id === event.localId ? { ...n, id: event.id } : n)) }
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
      return { ...s, deck: { ...s.deck, refining: null } }
    case "deck_undo":
      return deckUndo(user, ctx)
    case "deck_review_skipped":
      return deckReviewSkipped(s)
    case "composer_draft":
      return { ...s, composerDraft: event.text }
    case "bulk_requested":
      return event.postIds.length ? upsertRequest(user, ctx, "bulk_approve", event.postIds).state : s
    case "handoff_in":
      return handoffIn(s, ctx, event.carry)
    case "handoff_out": {
      const postId = contextPostId(s)
      const week = postId && s.posts[postId] ? weekOf(s.posts[postId].scheduledDate ?? "") : undefined
      return effect(s, { type: "navigate", view: "interface", ...(week ? { week } : {}), ...(postId ? { post: postId } : {}) })
    }
    case "canvas_visibility":
      return { ...s, canvas: { ...s.canvas, visibility: event.visibility } }
    case "show_card":
      return showCardEvent(s, event.card)
    case "context_set":
      return { ...s, context: event.context }
    case "hydrate_run": {
      const runs = s.runs.some((run) => run.id === event.run.id)
        ? s.runs.map((run) => (run.id === event.run.id ? event.run : run))
        : [...s.runs, event.run]
      return { ...s, run: event.run, runs }
    }
    case "hydrate_thread": {
      const unique = event.transcript.filter((entry, i, all) => all.findIndex((other) => other.id === entry.id) === i)
      if (unique.length === 0) return s
      const seen = new Set(unique.map((entry) => entry.id))
      const extra = s.transcript.filter((entry) => !seen.has(entry.id) && entry.id !== "m-intro")
      const intro = s.transcript.filter((entry) => entry.id === "m-intro" && !seen.has(entry.id))
      return { ...s, transcript: [...intro, ...unique, ...extra], miniChat: [...unique, ...extra].filter((e) => e.role !== "system").slice(-4) }
    }
    case "hydrate_posts":
      return hydratePosts(s, ctx, event.posts)
    case "hydrate_skipped": {
      const skipped = new Set(event.ids)
      if (s.deck.decisions.length || s.deck.order.length === 0) return { ...s, skippedPostIds: event.ids }
      const head = s.deck.order.filter((id) => !skipped.has(id))
      const tail = s.deck.order.filter((id) => skipped.has(id))
      return { ...s, skippedPostIds: event.ids, deck: { ...s.deck, order: [...head, ...tail] } }
    }
    case "hydrate_activity": {
      const seen = new Set(s.activity.map((entry) => entry.id))
      const extra = event.entries.filter((entry) => !seen.has(entry.id))
      return extra.length ? { ...s, activity: [...extra, ...s.activity] } : s
    }
    case "post_patched": {
      const post = s.posts[event.postId]
      if (!post) return s
      return patchPost(s, event.postId, {
        ...(event.blurb !== undefined ? { blurb: event.blurb } : {}),
        ...(event.detailedBrief !== undefined ? { detailedBrief: event.detailedBrief } : {}),
        contentRev: Math.max(ctx.now, post.contentRev + 1),
      })
    }
    case "hydrate_ideas": {
      const ideas = event.ideas
      const ids = Object.keys(ideas)
      let next: EngineState = { ...s, ideas }
      const card = next.canvas.card
      if (card?.kind === "directions" && ids.length > 0 && (next.canvas.status === "empty" || next.canvas.status === "streaming") && next.run?.status !== "running") {
        const selectedId = ids.includes(card.selectedId) ? card.selectedId : ids[0]
        next = { ...next, canvas: { ...next.canvas, status: "ready", card: { ...card, selectedId } } }
      }
      return next
    }
    case "hydrate_glance":
      return { ...s, glance: { reconnectDays: event.reconnectDays, events: event.events } }
    case "hydrate_notes": {
      const local = s.notes.filter((n) => n.id.startsWith("note-"))
      const ids = new Set(event.notes.map((n) => n.id))
      const reads = [...event.reads, ...s.reads.filter((r) => !event.reads.some((e) => e.postId === r.postId && e.userId === r.userId))]
      return { ...s, notes: [...event.notes, ...local.filter((n) => !ids.has(n.id))], reads }
    }
    case "hydrate_usage":
      return { ...s, usage: { used: event.used, limit: event.limit } }
    case "assistant_delta": {
      const last = s.transcript[s.transcript.length - 1]
      if (last?.role === "assistant" && last.streaming) {
        return { ...s, transcript: [...s.transcript.slice(0, -1), { ...last, text: `${last.text ?? ""}${event.text}` }] }
      }
      const entry: TranscriptEntry = { id: nextId(ctx, "m"), role: "assistant", text: event.text, createdAt: now, streaming: true }
      return { ...s, transcript: [...s.transcript, entry] }
    }
    case "request_opened": {
      const { state: opened, requestId } = upsertRequest(s, ctx, event.action, event.postIds, { ...(event.when ? { when: event.when } : {}), ...(event.runId ? { runId: event.runId } : {}), ...(event.localRunId ? { localRunId: event.localRunId } : {}) })
      const attached = say(opened, ctx, ctx.copy.reply.approvalAsk, [{ kind: "approval", requestId }])
      return effect({ ...attached, lastEventKind: "run" }, { type: "announce", message: ctx.copy.reply.approvalAsk })
    }
  }
}

export function deriveChip(state: EngineState, copy: Copy): { state: StateChipState; label: string; shortLabel: string } | null {
  const run = state.run
  if (run?.status === "running") {
    const n = run.steps.length
    const i = Math.max(0, run.steps.findIndex((step) => step.state === "running")) + 1
    return { state: "working", label: copy.chip.working(i, n), shortLabel: copy.chip.workingShort(i, n) }
  }
  if (state.requests.some((r) => r.status === "pending") || run?.status === "needs_you") return { state: "needs_you", label: copy.chip.needs_you, shortLabel: copy.chip.needs_you }
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
  const drafts: QueueEntry[] = Object.values(state.posts)
    .filter((post) => !submitted.has(post.id) && post.status !== "archived" && post.agentMeta?.reviewState === "pending")
    .map((post) => post.id)
    .sort(byDate(state))
    .map((id) => ({ item: { id: `q-draft-${id}`, source: "agent_draft", postId: id }, needsViewer: approver }))
  return [...guardrail, ...contributor, ...drafts]
}

export function deriveGlance(state: EngineState, copy: Copy): GlanceCard[] {
  const glance = copy.mobile.glance
  const pending = state.deck.order.slice(state.deck.index).map((id) => state.posts[id]).filter((post): post is PrototypePost => Boolean(post))
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
    cards.push({ id: "glance-plan", tone: "brand-accent", title: glance.plan, line: glance.allClear, primary: { label: glance.plan, target: "plan" } })
  }
  return cards
}

function inWeek(date: string | undefined, week: string): boolean {
  return !!date && date >= week && date < addDays(week, 7)
}

export function deriveRail(state: EngineState, viewer: Viewer, week: WeekId, env: Pick<EngineEnv, "cadence" | "campaigns">): RailData {
  const posts = Object.values(state.posts).filter((p) => inWeek(p.scheduledDate, week))
  const scheduled = posts.filter((p) => p.status === "scheduled").length
  const review = posts.filter((p) => p.status === "review" || p.agentMeta?.reviewState === "pending").length
  const live = posts.filter((p) => p.status !== "archived").length
  const stats = { scheduled, review, slots: Math.max(0, env.cadence - live), campaigns: env.campaigns }
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
    if (unreadFor(state.notes, state.reads, postId, viewer.id).mentions > 0) push(postId, "mention")
  }
  const nowKey = localKey(state.clock)
  const upcoming = new Map<string, { date: string; time: string }>()
  for (const p of Object.values(state.posts)) {
    if (p.status === "scheduled" && p.scheduledDate) upcoming.set(p.id, { date: p.scheduledDate, time: p.scheduledTime || "00:00" })
  }
  for (const slot of state.staged) upcoming.set(slot.postId, { date: slot.date, time: slot.time })
  const comingUp = [...upcoming.entries()]
    .filter(([, when]) => `${when.date} ${when.time}` >= nowKey)
    .sort((a, b) => `${a[1].date} ${a[1].time}`.localeCompare(`${b[1].date} ${b[1].time}`))
    .slice(0, 3)
    .map(([postId, when]) => ({ postId, title: postTitle(state, postId), when: formatWhen(when.date, when.time) }))
  return { stats, attention, comingUp }
}
