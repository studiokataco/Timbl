import type { CanvasCard, Scene } from "../types"

export type Intent =
  | "ideas"
  | "more_ideas"
  | "compare"
  | "plan"
  | "create"
  | "drafts"
  | "tighten"
  | "schedule"
  | "approvals"
  | "post_context"
  | "fallback"
  | "guardrail:publish"
  | "guardrail:delete"
  | "guardrail:bulk_approve"
  | "guardrail:reschedule"

export type RouterContext = {
  card: CanvasCard | null
  hasBrief: boolean
  hasDrafts: boolean
  contextPostId: string | null
  pendingOffer: "schedule" | null
}

export function routeIntent(text: string, ctx: RouterContext): Intent {
  const t = text.toLowerCase().trim()
  const cardKind = ctx.card?.kind ?? null
  if (ctx.pendingOffer === "schedule" && /^(yes|yep|sure|go ahead|do it|ok|okay)\b/.test(t)) return "schedule"
  if (/\b(publish|go live|post (it|this|them) now)\b/.test(t)) return "guardrail:publish"
  if (/\b(delete|remove)\b/.test(t)) return "guardrail:delete"
  if (/\b(approve all|bulk)\b/.test(t)) return "guardrail:bulk_approve"
  if (/\b(move|reschedule)\b/.test(t)) return "guardrail:reschedule"
  if (cardKind === "drafts" && /\b(tighten|shorter|punchier|rewrite|hook)\b/.test(t)) return "tighten"
  if (/\b(approvals?|review queue|needs? (my )?approval|what needs me)\b/.test(t)) return "approvals"
  if (/\b(schedule|calendar|cadence|publishing plan)\b/.test(t)) return ctx.hasDrafts ? "schedule" : "plan"
  if (/\b(drafts?|write|copy|captions?|posts?)\b/.test(t)) {
    if (ctx.hasDrafts) return "drafts"
    return ctx.hasBrief ? "create" : "plan"
  }
  if (cardKind === "directions" && /\b(more|other|different)\b/.test(t)) return "more_ideas"
  if (cardKind === "directions" && /\b(strongest|compare|recommend|which)\b/.test(t)) return "compare"
  if (/\b(ideas?|campaign|launch|directions?|explore|concepts?)\b/.test(t)) return "ideas"
  if (ctx.contextPostId) return "post_context"
  return "fallback"
}

export type RouterSample = { text: string; scene: Scene; ctx: RouterContext; expected: Intent }

const EMPTY: RouterContext = { card: null, hasBrief: false, hasDrafts: false, contextPostId: null, pendingOffer: null }
const DIRECTIONS: RouterContext = { ...EMPTY, card: { kind: "directions", set: "first", selectedId: "idea-1" } }
const BRIEF: RouterContext = { ...EMPTY, card: { kind: "brief" }, hasBrief: true }
const DRAFTS: RouterContext = { ...EMPTY, card: { kind: "drafts", activeIndex: 0 }, hasBrief: true, hasDrafts: true }

export const ROUTER_SAMPLES: RouterSample[] = [
  { text: "schedule a post", scene: "drafts", ctx: DRAFTS, expected: "schedule" },
  { text: "review the campaign", scene: "empty", ctx: EMPTY, expected: "ideas" },
  { text: "preview the reel", scene: "empty", ctx: EMPTY, expected: "fallback" },
  { text: "rewrite the hook", scene: "drafts", ctx: DRAFTS, expected: "tighten" },
  { text: "publish the schedule", scene: "drafts", ctx: DRAFTS, expected: "guardrail:publish" },
  { text: "Explore creative directions", scene: "empty", ctx: EMPTY, expected: "ideas" },
  { text: "Draft social posts", scene: "empty", ctx: EMPTY, expected: "plan" },
  { text: "Move Thursday's post to Friday and make it a bit shorter", scene: "empty", ctx: EMPTY, expected: "guardrail:reschedule" },
  { text: "Show me more ideas", scene: "directions", ctx: DIRECTIONS, expected: "more_ideas" },
  { text: "Which direction is strongest?", scene: "directions", ctx: DIRECTIONS, expected: "compare" },
  { text: "Draft social posts", scene: "brief", ctx: BRIEF, expected: "create" },
  { text: "Draft social posts", scene: "drafts", ctx: DRAFTS, expected: "drafts" },
  { text: "Plan the schedule", scene: "drafts", ctx: DRAFTS, expected: "schedule" },
  { text: "Review approvals", scene: "empty", ctx: EMPTY, expected: "approvals" },
  { text: "delete the reel", scene: "drafts", ctx: DRAFTS, expected: "guardrail:delete" },
  { text: "approve all", scene: "drafts", ctx: DRAFTS, expected: "guardrail:bulk_approve" },
]
