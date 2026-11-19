import type { Post } from "@/lib/schemas/post"
import type { Comment } from "@/lib/schemas/comment"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import type { User } from "@/lib/schemas/user"
import type { ChannelKey, NextAction, RejectReason, UserRole } from "@/lib/schemas/_shared"
import type { ThreadMessage } from "@/lib/storage/agent-threads"

export type { UserRole, ChannelKey, RejectReason }

export type PrototypeView = "timbl" | "interface" | "mobile"
export type CanvasVisibility = "shown" | "hidden" | "expanded"
export type SheetId = "activity" | "persona" | "flyout" | "talk" | "rail" | "nav" | "notes" | "peek" | "approve-all"
export type MobileScreen = "glance" | "approve" | "chat"
export type WeekId = string
export type CalendarFilter = "all" | "drafts" | "scheduled" | "needs-approval" | "sent"
export type ViewState = {
  view: PrototypeView; canvas: CanvasVisibility; sheet: SheetId | null; post: string | null
  screen: MobileScreen; week: WeekId; filter: CalendarFilter
}
export type AmbientSignal = { active: boolean; source: "mic" | "output" | null; outputId: string | null; outputChars: number; working: boolean; level: number }

export type ToneToken = "brand-accent" | "success" | "warning" | "destructive" | "badge-orange" | "badge-pink" | "badge-violet" | "badge-emerald" | "muted"
export type PresenceSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type TeamMember = User & { initials: string; presenceSlot: PresenceSlot }

export type PreviewTileSpec = { headline: string; format: string }
export type PrototypePost = Post & { tile: PreviewTileSpec; contentRev: number }

export type PresenceOrbState = "idle" | "listening" | "working" | "needs_you" | "done" | "error"
export type StateChipState = "working" | "needs_you" | "error" | "done"
export type MicState = "idle" | "requesting" | "listening" | "transcribing" | "denied" | "error"
export type TalkState = "idle" | "requesting" | "listening" | "sending" | "denied" | "no_speech"

export type RunKind = "ideas" | "plan" | "create" | "refine" | "advice" | "chat"
export type RunStepState = "pending" | "running" | "done" | "failed" | "cancelled"
export type RunStep = { id: string; toolName: string; label: string; doneLabel: string; state: RunStepState; error?: string; startedAt?: number; finishedAt?: number }
export type RunStatus = "proposed" | "running" | "needs_you" | "done" | "error" | "cancelled"
export type Run = {
  id: string; kind: RunKind; title: string; status: RunStatus; steps: RunStep[]; startedAt?: number; finishedAt?: number
  agent: string; input: string; postId?: string; refine?: RefineKind; postIds?: string[]; error?: string; serverRunId?: string
}

export type ReactionEmoji = "👍" | "❤️" | "🎉" | "😂" | "👀" | "🙌" | "🔥" | "✅"
export type NoteAnnotation = { type: "mention" | "link"; indices: [number, number]; displayValue: string; userId?: string; url?: string }
export type NoteReaction = { emoji: ReactionEmoji; userIds: string[] }
export type NoteSystemEvent = { event: "approved" | "sent_back" | "submitted" | "edited_after_approval" | "withdrawn"; actorId: string; reason?: RejectReason; detail?: string }
export type PrototypeNote = Comment & {
  kind: "note" | "system"
  annotations: NoteAnnotation[]
  mentionUserIds: string[]
  reactions: NoteReaction[]
  editedAt?: string
  system?: NoteSystemEvent
}
export type NoteReadState = { postId: string; userId: string; lastReadAt: string }
export type NoteBlock =
  | { kind: "paragraph"; spans: NoteSpan[] }
  | { kind: "list"; items: NoteSpan[][] }
export type NoteSpan =
  | { kind: "text"; text: string; strong?: boolean; em?: boolean; code?: boolean }
  | { kind: "link"; text: string; url: string }
  | { kind: "mention"; text: string; userId: string }

export type ApprovalSubmission = {
  postId: string; submittedBy: string; submittedAt: string; contentRev: number
  requiredApprovers: number; approvals: { by: string; at: string; rev: number }[]
  decision?: { by: string; at: string; outcome: "approved" | "sent_back"; reason?: RejectReason; note?: string }
}
export type GuardrailAction = "schedule" | "reschedule" | "publish" | "delete" | "bulk_approve"
export type GuardrailRequest = {
  id: string; action: GuardrailAction; postIds: string[]; when?: string
  status: "pending" | "approved" | "changes_requested" | "expired" | "submitted"
  requestedAt: string; resolvedAt?: string; feedback?: string; nextAction?: NextAction
  runId?: string; localRunId?: string
  to?: { date: string; time?: string }
  prev?: Record<string, { status: string; date: string; time?: string }>
}
export type ApprovalQueueItem =
  | { id: string; source: "agent_draft"; postId: string }
  | { id: string; source: "contributor"; postId: string }
  | { id: string; source: "guardrail"; requestId: string }

export type BriefObjective = "awareness" | "engagement" | "leads"
export type BriefChannels = "ig_li" | "ig" | "li" | "ig_li_x"
export type BriefVolume = "three_with_reel" | "five_two_reels" | "three_with_carousel"
export type BriefFields = { campaignName: string; objective: BriefObjective; startDate: string; channels: BriefChannels; volume: BriefVolume }
export type ScheduleSlot = { postId: string; date: string; time: string; channel: ChannelKey }
export type CanvasCard =
  | { kind: "directions"; set: "first" | "more"; selectedId: string }
  | { kind: "recommendation"; ideaId: string; alternateId: string }
  | { kind: "brief" }
  | { kind: "drafts"; activeIndex: number }
  | { kind: "schedule"; requestId?: string }
  | { kind: "handoff" }
  | { kind: "approvals_queue" }
  | { kind: "current_item"; postId: string; origin: "handoff" | "queue" | "context" }
export type CardStatus = "ready" | "streaming" | "needs_you" | "error" | "empty" | "cap_reached" | "done"

export type RichSpan = { text: string; strong?: boolean; muted?: boolean }
export type TranscriptAttachment =
  | { kind: "plan"; runId: string }
  | { kind: "approval"; requestId: string }
  | { kind: "card_link"; card: CanvasCard }
  | { kind: "cap" }
  | { kind: "error"; runId: string }
export type TranscriptEntry = ThreadMessage & {
  rich?: RichSpan[]
  source?: "typed" | "voice" | "chip" | "flyout"
  attachments?: TranscriptAttachment[]
  divider?: "handoff" | "new_chat"
  queued?: boolean
  streaming?: boolean
}

export type VoiceToken = { text: string; final: boolean; atMs: number }
export type ResolvedEntityChip = { kind: "post" | "action"; label: string; refId?: string }

export type GlanceTarget = "approve_all" | "review" | "reconnect" | "plan"
export type GlanceCard = { id: string; tone: ToneToken; title: string; line?: string; primary?: { label: string; target: GlanceTarget }; secondary?: { label: string; target: GlanceTarget } }
export type RefineKind = "shorter" | "funnier" | "new_image"
export type ApproveDeckEntry = { postId: string; brandCheck: { ok: boolean; note: string } }
export type DeckDecision = { postId: string; outcome: "approved" | "skipped" | "submitted" }

export type CursorWaypoint = { atMs: number; day: string; hour: number; fx: number; fy: number; activity?: "viewing" | "editing_caption" }
export type TeamPresence = { sessionId: string; userId: string; surface: "calendar"; path: CursorWaypoint[]; idleAfterMs: number }

export type Personality = "calm" | "warm" | "direct" | "playful"
export type VoiceLocale = "en-IN" | "en-GB" | "en-US" | "hi-IN" | "hinglish"
export type PresencePrefs = {
  reduceMotion: boolean; largerTarget: boolean; tips: boolean; voiceLocale: VoiceLocale; personality: Personality; workingStyle: string
  showCursors: boolean | null
  shortcuts: boolean
  ambient: { glow: boolean; backgroundMotion: boolean }
}

export type ActivityEntry = {
  id: string; at: string
  actor: { kind: "user"; userId: string } | { kind: "assistant" }
  kind: "run" | "drafted" | "approved" | "sent_back" | "submitted" | "note" | "staged" | "request_approved" | "changes_requested" | "undone" | "withdrawn" | "stale"
  postId?: string; runId?: string; steps?: RunStep[]; count?: number
}

export type ContextRef = { kind: "calendar"; week: WeekId } | { kind: "post"; postId: string } | { kind: "none" }
export type EngineEnv = { assistantName: string; role: UserRole; viewerId: string; team: TeamMember[]; cadence: number; campaigns: number }
export type CardAction =
  | { card: "directions"; kind: "select"; ideaId: string }
  | { card: "directions"; kind: "build" }
  | { card: "directions"; kind: "compare" }
  | { card: "directions"; kind: "more" }
  | { card: "recommendation"; kind: "use" }
  | { card: "recommendation"; kind: "keep_exploring" }
  | { card: "brief"; kind: "edit"; patch: Partial<BriefFields> }
  | { card: "brief"; kind: "create" }
  | { card: "brief"; kind: "debate" }
  | { card: "drafts"; kind: "tab"; index: number }
  | { card: "drafts"; kind: "approve"; postId: string }
  | { card: "drafts"; kind: "undo_approve"; postId: string }
  | { card: "drafts"; kind: "submit"; postId: string }
  | { card: "drafts"; kind: "tighten"; postId: string }
  | { card: "drafts"; kind: "plan_schedule" }
  | { card: "schedule"; kind: "edit_slot"; index: number; patch: Partial<ScheduleSlot> }
  | { card: "schedule"; kind: "confirm" }
  | { card: "schedule"; kind: "cadence" }
  | { card: "handoff"; kind: "open_calendar" }
  | { card: "handoff"; kind: "review" }
  | { card: "approvals_queue"; kind: "open_item"; itemId: string }
  | { card: "approvals_queue"; kind: "review_next" }
  | { card: "approvals_queue"; kind: "open_activity" }
  | { card: "current_item"; kind: "apply_edit"; blurb: string }
  | { card: "current_item"; kind: "open_editor" }
export type EngineEvent =
  | { type: "user_sent"; text: string; source: "typed" | "voice" | "chip" }
  | { type: "queue_removed"; index: number }
  | { type: "new_mini_chat" }
  | { type: "thread_reset" }
  | { type: "card_action"; action: CardAction }
  | { type: "run_start" } | { type: "run_revise" } | { type: "run_stop" } | { type: "retry" }
  | { type: "run_stage"; runId: string; agent: string }
  | { type: "run_post"; runId: string; postId: string }
  | { type: "run_server"; runId: string; serverRunId: string }
  | { type: "run_done"; runId: string }
  | { type: "run_failed"; runId: string; error: string }
  | { type: "request_resolved"; requestId: string | "latest"; outcome: "approved" | "changes_requested"; feedback?: string }
  | { type: "request_undo"; requestId: string }
  | { type: "caption_edited"; postId: string; blurb: string }
  | { type: "note_added"; postId: string; body: string }
  | { type: "note_edited"; noteId: string; body: string }
  | { type: "note_deleted"; noteId: string }
  | { type: "note_reacted"; noteId: string; emoji: ReactionEmoji }
  | { type: "thread_read"; postId: string }
  | { type: "submission_decided"; postId: string; outcome: "approved" | "sent_back"; reason?: RejectReason; note?: string }
  | { type: "submission_withdrawn"; postId: string }
  | { type: "deck_decided"; postId: string; outcome: "approved" | "skipped" | "submitted" }
  | { type: "deck_refine"; postId: string; kind: RefineKind }
  | { type: "deck_refined"; postId: string; kind: RefineKind }
  | { type: "deck_undo" }
  | { type: "deck_review_skipped" }
  | { type: "composer_draft"; text: string }
  | { type: "bulk_requested"; postIds: string[] }
  | { type: "handoff_in"; carry: "chat" | "chat_and_item" | "none" }
  | { type: "handoff_out" }
  | { type: "canvas_visibility"; visibility: CanvasVisibility }
  | { type: "show_card"; card: CanvasCard }
  | { type: "context_set"; context: ContextRef }
  | { type: "hydrate_thread"; transcript: TranscriptEntry[] }
  | { type: "hydrate_run"; run: Run }
  | { type: "hydrate_notes"; notes: PrototypeNote[]; reads: NoteReadState[] }
  | { type: "hydrate_usage"; used: number; limit: number }
  | { type: "note_saved"; localId: string; id: string }
  | { type: "hydrate_posts"; posts: Record<string, PrototypePost> }
  | { type: "hydrate_ideas"; ideas: Record<string, IdeationItem> }
  | { type: "hydrate_glance"; reconnectDays: number | null; events: { name: string; date: string }[] }
  | { type: "hydrate_skipped"; ids: string[] }
  | { type: "hydrate_activity"; entries: ActivityEntry[] }
  | { type: "post_patched"; postId: string; blurb?: string; detailedBrief?: string }
  | { type: "assistant_delta"; text: string }
  | { type: "request_opened"; action: GuardrailAction; postIds: string[]; when?: string; runId?: string; localRunId?: string }
export type PersistOp =
  | { kind: "approve"; postId: string }
  | { kind: "unapprove"; postId: string }
  | { kind: "status"; postId: string; status: string }
  | { kind: "move"; postId: string; date: string; time?: string }
  | { kind: "caption"; postId: string; blurb: string }
  | { kind: "publish"; postId: string }
  | { kind: "delete"; postId: string }
  | { kind: "note_add"; postId: string; localId: string; body: string; mentions: string[] }
  | { kind: "note_edit"; postId: string; noteId: string; body: string; mentions: string[] }
  | { kind: "note_delete"; postId: string; noteId: string }
  | { kind: "note_react"; postId: string; noteId: string; emoji: ReactionEmoji }
  | { kind: "read"; postId: string }
  | { kind: "bulk_approve"; postIds: string[] }
  | { kind: "deck_skips"; postIds: string[] }
  | { kind: "gate"; serverRunId: string; approved: boolean; feedback?: string }
export type EngineEffect =
  | { type: "persist"; op: PersistOp }
  | { type: "canvas_shown" }
  | { type: "scroll_to"; requestId: string }
  | { type: "navigate"; view: "timbl" | "interface"; week?: WeekId; post?: string; carry?: string }
  | { type: "open_sheet"; sheet: SheetId; post?: string }
  | { type: "toast"; id: string; message: string; undo?: EngineEvent; position?: "top-center" }
  | { type: "focus_composer" }
  | { type: "announce"; message: string; assertive?: boolean }
export type EngineState = {
  seq: number; clock: number
  transcript: TranscriptEntry[]; miniChat: TranscriptEntry[]; queue: string[]
  canvas: { card: CanvasCard | null; status: CardStatus; visibility: CanvasVisibility }
  run: Run | null; runs: Run[]
  requests: GuardrailRequest[]
  posts: Record<string, PrototypePost>
  drafts: { visible: boolean; ids: string[]; approved: string[]; submitted: string[] }
  deck: { order: string[]; index: number; decisions: DeckDecision[]; refining: { postId: string; kind: RefineKind } | null }
  skippedPostIds: string[]
  notes: PrototypeNote[]; reads: NoteReadState[]; submissions: ApprovalSubmission[]; activity: ActivityEntry[]
  ideaSet: "first" | "more"; chosenIdeaId: string | null
  ideas: Record<string, IdeationItem>
  glance: { reconnectDays: number | null; events: { name: string; date: string }[] }
  brief: BriefFields; schedule: ScheduleSlot[]; staged: ScheduleSlot[]
  context: ContextRef; usage: { used: number; limit: number }
  composerDraft: string; pendingOffer: "schedule" | null
  lastEventKind: "user" | "run" | null
  effects: EngineEffect[]
}
