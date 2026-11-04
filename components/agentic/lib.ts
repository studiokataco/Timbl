import { z } from "zod"
import { CHANNEL_LABELS } from "@/lib/labels/enums"
import { REJECT_REASONS } from "@/lib/schemas/_shared"
import type { Post } from "@/lib/schemas/post"
import { makeCopy } from "./copy"
import type {
  ChannelKey,
  NoteAnnotation,
  NoteBlock,
  NoteReadState,
  NoteSpan,
  PresencePrefs,
  PresenceSlot,
  PrototypeNote,
  TeamMember,
  ToneToken,
} from "./types"

export function tw(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

export const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const EASE_IN = [0.4, 0, 1, 1] as const
export const DUR = { enter: 0.2, exit: 0.14, fade: 0.12, pop: 0.36, morph: 0.32, sweep: 0.6, appear: 0.18, layout: 0.35, bubble: 0.22 } as const
export const BUBBLE_ENTER = { y: 12, scale: 0.98 } as const
export const SPRING = { type: "spring", stiffness: 420, damping: 32 } as const
export const SPRING_SOFT = { type: "spring", stiffness: 380, damping: 34 } as const
export const STAGGER = 0.04
export const STEP_MS = { normal: 700, instant: 0 } as const
export const TOUCH = { icon: "size-11", control: "h-11", grabber: "h-11" } as const
export const REDUCED_POPUP = "transition-none data-open:animate-none! data-closed:animate-none!"
export const TOAST_UNDO_MS = 10000

export function showCursorsEffective(prefs: PresencePrefs, reduced: boolean): boolean {
  return prefs.showCursors ?? !reduced
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ""
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function primaryChannel(post: Pick<Post, "channelStatuses">): ChannelKey {
  const key = Object.keys(post.channelStatuses).find((k): k is ChannelKey => k in CHANNEL_LABELS)
  return key ?? "instagram"
}

const INLINE =
  /\*\*([^*\n]+)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+)|(^|[^\p{L}\p{N}_*])\*([^*\n]+)\*(?![\p{L}\p{N}_])|(^|[^\p{L}\p{N}_])_([^_\n]+)_(?![\p{L}\p{N}_])/gu
const SAFE_URL = /^https?:\/\/[^\s]+$/i
const TRAILING_PUNCT = /[.,!?;:]+$/

function pushText(spans: NoteSpan[], text: string) {
  if (!text) return
  const prev = spans[spans.length - 1]
  if (prev?.kind === "text" && !prev.strong && !prev.em && !prev.code) prev.text += text
  else spans.push({ kind: "text", text })
}

function parseInline(text: string): NoteSpan[] {
  const spans: NoteSpan[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    pushText(spans, text.slice(last, at))
    last = at + m[0].length
    if (m[1] !== undefined) spans.push({ kind: "text", text: m[1], strong: true })
    else if (m[2] !== undefined) spans.push({ kind: "text", text: m[2], code: true })
    else if (m[3] !== undefined) {
      if (SAFE_URL.test(m[4])) spans.push({ kind: "link", text: m[3], url: m[4] })
      else pushText(spans, m[0])
    } else if (m[5] !== undefined) {
      const trail = m[5].match(TRAILING_PUNCT)?.[0] ?? ""
      const url = trail ? m[5].slice(0, -trail.length) : m[5]
      spans.push({ kind: "link", text: url, url })
      pushText(spans, trail)
    } else if (m[7] !== undefined) {
      pushText(spans, m[6])
      spans.push({ kind: "text", text: m[7], em: true })
    } else if (m[9] !== undefined) {
      pushText(spans, m[8])
      spans.push({ kind: "text", text: m[9], em: true })
    }
  }
  pushText(spans, text.slice(last))
  return spans
}

function parseSegment(body: string, start: number, end: number, mentions: NoteAnnotation[]): NoteSpan[] {
  const spans: NoteSpan[] = []
  let cursor = start
  for (const a of mentions) {
    const [from, to] = a.indices
    if (from < cursor || to > end || !a.userId) continue
    spans.push(...parseInline(body.slice(cursor, from)))
    spans.push({ kind: "mention", text: body.slice(from, to), userId: a.userId })
    cursor = to
  }
  spans.push(...parseInline(body.slice(cursor, end)))
  return spans
}

export function parseNoteBody(body: string, annotations: NoteAnnotation[] = []): NoteBlock[] {
  const mentions = annotations
    .filter((a) => a.type === "mention")
    .sort((a, b) => a.indices[0] - b.indices[0])
  const blocks: NoteBlock[] = []
  let paragraph: NoteSpan[] | null = null
  let list: NoteSpan[][] | null = null
  const close = () => {
    if (paragraph) blocks.push({ kind: "paragraph", spans: paragraph })
    if (list) blocks.push({ kind: "list", items: list })
    paragraph = null
    list = null
  }
  let offset = 0
  for (const raw of body.split("\n")) {
    const lineStart = offset
    offset += raw.length + 1
    const line = raw.replace(/\r$/, "")
    const lineEnd = lineStart + line.length
    if (line.trim() === "") {
      close()
      continue
    }
    if (line.startsWith("- ")) {
      if (paragraph) close()
      list ??= []
      list.push(parseSegment(body, lineStart + 2, lineEnd, mentions))
      continue
    }
    if (list) close()
    const spans = parseSegment(body, lineStart, lineEnd, mentions)
    if (paragraph) {
      paragraph.push({ kind: "text", text: "\n" }, ...spans)
    } else {
      paragraph = spans
    }
  }
  close()
  return blocks
}

const NAME_EDGE = /[\p{L}\p{N}_]/u

export function extractMentions(body: string, team: Pick<TeamMember, "id" | "name">[]): { annotations: NoteAnnotation[]; mentionUserIds: string[] } {
  const lower = body.toLowerCase()
  const members = [...team].sort((a, b) => b.name.length - a.name.length)
  const found: NoteAnnotation[] = []
  for (const member of members) {
    const token = `@${member.name.toLowerCase()}`
    let from = lower.indexOf(token)
    while (from !== -1) {
      const to = from + token.length
      const before = from === 0 ? "" : body[from - 1]
      const after = body[to] ?? ""
      const taken = found.some((a) => from < a.indices[1] && to > a.indices[0])
      if (!taken && !NAME_EDGE.test(before) && !NAME_EDGE.test(after)) {
        found.push({ type: "mention", indices: [from, to], displayValue: body.slice(from, to), userId: member.id })
      }
      from = lower.indexOf(token, to)
    }
  }
  found.sort((a, b) => a.indices[0] - b.indices[0])
  const mentionUserIds = [...new Set(found.map((a) => a.userId as string))]
  return { annotations: found, mentionUserIds }
}

const MENTION_QUERY_MAX = 24

export function mentionQueryAt(value: string, caret: number, names: string[] = []): { query: string; start: number } | null {
  const before = value.slice(0, caret)
  const start = before.lastIndexOf("@")
  if (start === -1) return null
  if (start > 0 && !/[\s(]/.test(before[start - 1])) return null
  const query = before.slice(start + 1)
  if (query.length > MENTION_QUERY_MAX || query.includes("\n") || query.startsWith(" ")) return null
  if (/\s/.test(query)) {
    const q = query.toLowerCase()
    if (!names.some((n) => n.toLowerCase().startsWith(q))) return null
  }
  return { query, start }
}

export function unreadFor(
  notes: Pick<PrototypeNote, "postId" | "authorId" | "createdAt" | "mentionUserIds">[],
  reads: NoteReadState[],
  postId: string,
  viewerId: string,
): { count: number; mentions: number } {
  const read = reads.find((r) => r.postId === postId && r.userId === viewerId)
  const since = read ? Date.parse(read.lastReadAt) : Number.NEGATIVE_INFINITY
  let count = 0
  let mentions = 0
  for (const n of notes) {
    if (n.postId !== postId || n.authorId === viewerId || Date.parse(n.createdAt) <= since) continue
    count += 1
    if (n.mentionUserIds.includes(viewerId)) mentions += 1
  }
  return { count, mentions }
}

const FORM_COPY = makeCopy("Timbl")

export const personaSchema = z.object({
  assistantName: z
    .string()
    .trim()
    .min(2, FORM_COPY.persona.nameLength)
    .max(24, FORM_COPY.persona.nameLength)
    .regex(/^[\p{L}\p{M}\p{N} ]+$/u, FORM_COPY.persona.nameChars),
  reduceMotion: z.boolean(),
  largerTarget: z.boolean(),
  tips: z.boolean(),
  voiceLocale: z.enum(["en-IN", "en-GB", "en-US", "hi-IN", "hinglish"]),
  personality: z.enum(["calm", "warm", "direct", "playful"]),
  workingStyle: z.string().trim(),
  showCursors: z.boolean(),
  shortcuts: z.boolean(),
  ambient: z.object({ glow: z.boolean(), backgroundMotion: z.boolean() }),
})

export const sendBackSchema = z
  .object({
    reason: z.enum(REJECT_REASONS, { error: FORM_COPY.approve.reasonRequired }),
    note: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (value.reason === "other" && value.note.length === 0) {
      ctx.addIssue({ code: "custom", path: ["note"], message: FORM_COPY.approve.noteRequired })
    }
  })

export const requestChangesSchema = z.object({ feedback: z.string().trim().min(1) })

export const TONE_DOT: Record<ToneToken, string> = {
  "brand-accent": "bg-brand-accent", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive",
  "badge-orange": "bg-badge-orange", "badge-pink": "bg-badge-pink", "badge-violet": "bg-badge-violet",
  "badge-emerald": "bg-badge-emerald", muted: "bg-muted-foreground",
}
export const TONE_BG: Record<"badge-orange" | "badge-pink" | "badge-violet" | "badge-emerald", string> = {
  "badge-orange": "bg-badge-orange/20", "badge-pink": "bg-badge-pink/20", "badge-violet": "bg-badge-violet/20", "badge-emerald": "bg-badge-emerald/20",
}
export const PRESENCE_BG: Record<PresenceSlot, string> = {
  1: "bg-team-presence-1",
  2: "bg-team-presence-2",
  3: "bg-team-presence-3",
  4: "bg-team-presence-4",
  5: "bg-team-presence-5",
  6: "bg-team-presence-6",
  7: "bg-team-presence-7",
  8: "bg-team-presence-8",
}
export const PRESENCE_FILL: Record<PresenceSlot, string> = {
  1: "fill-team-presence-1 text-team-presence-1",
  2: "fill-team-presence-2 text-team-presence-2",
  3: "fill-team-presence-3 text-team-presence-3",
  4: "fill-team-presence-4 text-team-presence-4",
  5: "fill-team-presence-5 text-team-presence-5",
  6: "fill-team-presence-6 text-team-presence-6",
  7: "fill-team-presence-7 text-team-presence-7",
  8: "fill-team-presence-8 text-team-presence-8",
}
export const PRESENCE_RING: Record<PresenceSlot, string> = {
  1: "ring-team-presence-1",
  2: "ring-team-presence-2",
  3: "ring-team-presence-3",
  4: "ring-team-presence-4",
  5: "ring-team-presence-5",
  6: "ring-team-presence-6",
  7: "ring-team-presence-7",
  8: "ring-team-presence-8",
}
export const CHANNEL_PILL: Record<ChannelKey, string> = {
  instagram: "bg-badge-orange/20", linkedin: "bg-brand-accent/15", x: "bg-surface-strong", facebook: "bg-brand-accent/15", website: "bg-surface-strong", fb_groups: "bg-brand-accent/15",
}
