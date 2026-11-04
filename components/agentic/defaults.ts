import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { TIMBL_DEMO_ORG_ID, TIMBL_DEV_ADMIN_EMAIL } from "@/lib/constants/timbl"
import type {
  ActivityEntry,
  ApprovalSubmission,
  ApproveDeckEntry,
  BriefFields,
  GlanceTarget,
  NoteReadState,
  PeerElsewhere,
  PresencePrefs,
  PresenceSlot,
  PrototypeNote,
  PrototypePost,
  ReactionEmoji,
  RefineKind,
  RunKind,
  RunStep,
  ScheduleSlot,
  TeamMember,
  TeamPresence,
  ToneToken,
  VoiceScript,
  VoiceScriptId,
} from "./types"

export const ASSISTANT_ID = "assistant"
export const USAGE_LIMIT = 10_000

export const FALLBACK_VIEWER: TeamMember = {
  id: "admin",
  organizationId: TIMBL_DEMO_ORG_ID,
  name: "Timbl Admin",
  email: TIMBL_DEV_ADMIN_EMAIL,
  role: "admin",
  active: true,
  defaultCategories: [],
  initials: "TA",
  presenceSlot: 1,
}

export const DEFAULT_PREFS = {
  reduceMotion: false,
  largerTarget: false,
  tips: true,
  voiceLocale: "en-IN",
  personality: "calm",
  workingStyle: "Keep information concise. Bring a point of view. Ask only when a decision changes the outcome.",
  showCursors: null,
  shortcuts: true,
  ambient: { glow: true, backgroundMotion: true },
} satisfies PresencePrefs

export const REACTION_EMOJI: ReactionEmoji[] = ["👍", "❤️", "🎉", "😂", "👀", "🙌", "🔥", "✅"]
export const REACTION_NAMES: Record<ReactionEmoji, string> = {
  "👍": "Thumbs up",
  "❤️": "Heart",
  "🎉": "Party popper",
  "😂": "Laughing",
  "👀": "Eyes",
  "🙌": "Raised hands",
  "🔥": "Fire",
  "✅": "Check mark",
}

export const DEFAULT_BRIEF: BriefFields = {
  campaignName: "",
  objective: "awareness",
  startDate: "",
  channels: "ig_li",
  volume: "three_with_reel",
}

export const RUN_TEMPLATES: Record<RunKind, { title: string; steps: Omit<RunStep, "state">[] }> = {
  plan_to_drafts: {
    title: "Draft social posts",
    steps: [
      { id: "s1", toolName: "persistIdeation", label: "Picking a direction", doneLabel: "Picked a direction" },
      { id: "s2", toolName: "readBrandConfig", label: "Shaping the brief", doneLabel: "Shaped the brief" },
      { id: "s3", toolName: "createDraftPost", label: "Writing 3 drafts", doneLabel: "Wrote 3 drafts" },
    ],
  },
  create_drafts: {
    title: "Create the content",
    steps: [
      { id: "s1", toolName: "readBrandConfig", label: "Reading your brand voice", doneLabel: "Read your brand voice" },
      { id: "s2", toolName: "createDraftPost", label: "Writing the carousel", doneLabel: "Wrote the carousel" },
      { id: "s3", toolName: "createDraftPost", label: "Writing the LinkedIn post", doneLabel: "Wrote the LinkedIn post", error: "Couldn't save the LinkedIn post. Nothing was changed." },
      { id: "s4", toolName: "createDraftPost", label: "Writing the reel script", doneLabel: "Wrote the reel script" },
    ],
  },
  stage_schedule: {
    title: "Stage the schedule",
    steps: [
      { id: "s1", toolName: "findOpenSlots", label: "Checking open slots", doneLabel: "Checked open slots" },
      { id: "s2", toolName: "scheduleDraft", label: "Staging 3 posts", doneLabel: "Staged 3 posts" },
    ],
  },
}

const emptyVoice = (id: VoiceScriptId): VoiceScript => ({
  id,
  tokens: [],
  levels: [],
  chips: [],
  endpointMs: 0,
  sendText: "",
})

export const VOICE_SCRIPTS: Record<VoiceScriptId, VoiceScript> = {
  reschedule: {
    ...emptyVoice("reschedule"),
    sendText: "Move Thursday's post to Friday and make it a bit shorter",
  },
  shorter: { ...emptyVoice("shorter"), command: "shorter" },
  funnier: { ...emptyVoice("funnier"), command: "funnier" },
  new_image: { ...emptyVoice("new_image"), command: "new_image" },
  skip: { ...emptyVoice("skip"), command: "skip" },
  approve: { ...emptyVoice("approve"), command: "approve" },
  plan: {
    ...emptyVoice("plan"),
    sendText: "Plan a two week campaign for World Kindness Day",
  },
}

export const POSTS: Record<string, PrototypePost> = {}
export const NOTES: PrototypeNote[] = []
export const READS: NoteReadState[] = []
export const SUBMISSIONS: ApprovalSubmission[] = []
export const ACTIVITY_SEED: ActivityEntry[] = []
export const APPROVE_DECK: ApproveDeckEntry[] = []
export const AWARENESS: { date: string; name: string }[] = []
export const CAMPAIGNS: { status: string }[] = []
export const SOCIAL_ACCOUNTS: { id: string; status: string; expiresAt?: string }[] = []
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ""
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export const IDEAS: Record<string, IdeationItem> = {}
export const IDEAS_FIRST: string[] = []
export const IDEAS_MORE: string[] = []
export const DRAFT_POST_IDS: string[] = []
export const DEFAULT_SCHEDULE: ScheduleSlot[] = []
export const GLANCE_CARDS: { id: string; tone: ToneToken; primary?: GlanceTarget; secondary?: GlanceTarget }[] = []
export const REFINE_VARIANTS: Record<string, Record<RefineKind, string>> = {}
export const BRAND_CADENCE = { perWeek: 3 } as const
export const CURSOR_SCRIPTS: TeamPresence[] = []
export const PEERS_ELSEWHERE: PeerElsewhere[] = []
export const TEAM: TeamMember[] = []

export function asTeamMember(user: {
  id: string
  organizationId: string
  email: string
  name: string
  role: TeamMember["role"]
  active: boolean
  defaultCategories: string[]
  avatarUrl?: string
}, index: number): TeamMember {
  return {
    ...user,
    initials: initials(user.name),
    presenceSlot: ((index % 8) + 1) as PresenceSlot,
  }
}
