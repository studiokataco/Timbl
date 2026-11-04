import type {
  AudioSource,
  CalendarFilter,
  CanvasVisibility,
  MicState,
  MobileScreen,
  MotionChoice,
  PresenceOrbState,
  PrototypeView,
  Scene,
  SheetId,
  SpeedChoice,
  TalkState,
  ThemeChoice,
  UsageChoice,
  UserRole,
  ViewState,
  VoiceScriptId,
} from "./types"

export type { ViewState }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const DEFAULT_VIEW: ViewState = {
  view: "interface",
  theme: null,
  role: "admin",
  motion: "full",
  speed: "normal",
  toolbar: false,
  scene: "empty",
  canvas: "shown",
  sheet: null,
  post: null,
  orb: null,
  mic: null,
  talk: null,
  voice: null,
  screen: "glance",
  layout: "single",
  draft: 1,
  week: "",
  filter: "all",
  cursors: "live",
  usage: "ok",
  frame: null,
  isolate: false,
  audio: null,
  glow: null,
  mesh: null,
}

export const SCENE_PARAM: Record<Scene, string> = {
  empty: "empty",
  directions: "directions",
  recommendation: "recommendation",
  brief: "brief",
  plan: "plan",
  working: "working",
  drafts: "drafts",
  schedule: "schedule",
  schedule_approval: "schedule-approval",
  handoff: "handoff",
  approvals: "approvals",
  current: "current",
  current_queue: "current-queue",
  error: "error",
  cap: "cap",
}

export const ORB_PARAM: Record<PresenceOrbState, string> = {
  idle: "idle",
  listening: "listening",
  working: "working",
  needs_you: "needs-you",
  done: "done",
  error: "error",
}

export const TALK_PARAM: Record<TalkState, string> = {
  idle: "idle",
  requesting: "requesting",
  listening: "listening",
  sending: "sending",
  denied: "denied",
  no_speech: "no-speech",
}

export const VOICE_PARAM: Record<VoiceScriptId, string> = {
  reschedule: "reschedule",
  shorter: "shorter",
  funnier: "funnier",
  new_image: "new-image",
  skip: "skip",
  approve: "approve",
  plan: "plan",
}

const VIEWS: readonly PrototypeView[] = ["timbl", "interface", "mobile", "gallery"]
const THEMES: readonly ThemeChoice[] = ["light", "dark"]
const ROLES: readonly UserRole[] = ["admin", "editor", "contributor"]
const MOTIONS: readonly MotionChoice[] = ["full", "reduced"]
const SPEEDS: readonly SpeedChoice[] = ["normal", "instant"]
const CANVAS: readonly CanvasVisibility[] = ["shown", "hidden", "expanded"]
const SHEETS: readonly SheetId[] = ["activity", "persona", "flyout", "talk", "rail", "nav", "notes", "peek", "approve-all"]
const MICS: readonly MicState[] = ["idle", "requesting", "listening", "transcribing", "denied", "error"]
const SCREENS: readonly MobileScreen[] = ["glance", "approve", "chat"]
const LAYOUTS: readonly ViewState["layout"][] = ["single", "board"]
const FILTERS: readonly CalendarFilter[] = ["all", "drafts", "scheduled", "needs-approval", "sent"]
const CURSORS: readonly ViewState["cursors"][] = ["live", "idle", "off"]
const USAGES: readonly UsageChoice[] = ["ok", "near", "cap"]
const AUDIO: readonly AudioSource[] = ["mic", "scripted"]
const DRAFTS = ["1", "2", "3", "4"]
const FRAME_ID = /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/

type Input = URLSearchParams | Record<string, string | string[] | undefined>

function reader(input: Input): (key: string) => string | undefined {
  if (input instanceof URLSearchParams) return (key) => input.get(key) ?? undefined
  return (key) => {
    const value = input[key]
    return Array.isArray(value) ? value[0] : value
  }
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function pickNullable<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

function fromParam<T extends string>(map: Record<T, string>, value: string | undefined): T | null {
  if (value === undefined) return null
  const hit = (Object.keys(map) as T[]).find((key) => map[key] === value)
  return hit ?? null
}

function flag(value: string | undefined): boolean | null {
  if (value === "1") return true
  if (value === "0") return false
  return null
}

export function parseView(input: Input): ViewState {
  const get = reader(input)
  const post = get("post")
  const frame = get("frame")
  return {
    view: pick(get("view"), VIEWS, DEFAULT_VIEW.view),
    theme: pickNullable(get("theme"), THEMES),
    role: pick(get("role"), ROLES, DEFAULT_VIEW.role),
    motion: pick(get("motion"), MOTIONS, DEFAULT_VIEW.motion),
    speed: pick(get("speed"), SPEEDS, DEFAULT_VIEW.speed),
    toolbar: false,
    scene: fromParam(SCENE_PARAM, get("scene")) ?? DEFAULT_VIEW.scene,
    canvas: pick(get("canvas"), CANVAS, DEFAULT_VIEW.canvas),
    sheet: pickNullable(get("sheet"), SHEETS),
    post: post ? post : null,
    orb: fromParam(ORB_PARAM, get("orb")),
    mic: pickNullable(get("mic"), MICS),
    talk: fromParam(TALK_PARAM, get("talk")),
    voice: fromParam(VOICE_PARAM, get("voice")),
    screen: pick(get("screen"), SCREENS, DEFAULT_VIEW.screen),
    layout: pick(get("layout"), LAYOUTS, DEFAULT_VIEW.layout),
    draft: Number(pick(get("draft"), DRAFTS, "1")),
    week: ISO_DATE.test(get("week") ?? "") ? (get("week") as string) : DEFAULT_VIEW.week,
    filter: pick(get("filter"), FILTERS, DEFAULT_VIEW.filter),
    cursors: pick(get("cursors"), CURSORS, DEFAULT_VIEW.cursors),
    usage: pick(get("usage"), USAGES, DEFAULT_VIEW.usage),
    frame: frame !== undefined && FRAME_ID.test(frame) ? frame : null,
    isolate: get("isolate") === "1",
    audio: pickNullable(get("audio"), AUDIO),
    glow: flag(get("glow")),
    mesh: flag(get("mesh")),
  }
}

export function serializeView(view: ViewState): string {
  const out: Record<string, string> = {}
  if (view.view !== DEFAULT_VIEW.view) out.view = view.view
  if (view.sheet) out.sheet = view.sheet
  if (view.canvas !== DEFAULT_VIEW.canvas) out.canvas = view.canvas
  if (view.post) out.post = view.post
  if (view.screen !== DEFAULT_VIEW.screen) out.screen = view.screen
  if (view.week && view.week !== DEFAULT_VIEW.week) out.week = view.week
  if (view.filter !== DEFAULT_VIEW.filter) out.filter = view.filter
  if (view.voice) out.voice = VOICE_PARAM[view.voice]
  if (view.speed !== DEFAULT_VIEW.speed) out.speed = view.speed
  if (view.audio) out.audio = view.audio
  if (view.talk) out.talk = TALK_PARAM[view.talk]
  if (view.cursors !== DEFAULT_VIEW.cursors) out.cursors = view.cursors
  if (view.motion !== DEFAULT_VIEW.motion) out.motion = view.motion
  if (view.orb) out.orb = ORB_PARAM[view.orb]
  return Object.keys(out)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(out[key])}`)
    .join("&")
}

export function effectiveAudio(view: ViewState): AudioSource {
  return view.audio ?? (view.speed === "instant" ? "scripted" : "mic")
}
