import type { CalendarFilter, CanvasVisibility, MobileScreen, PrototypeView, SheetId, ViewState } from "./types"

export type { ViewState }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const DEFAULT_VIEW: ViewState = {
  view: "interface",
  canvas: "shown",
  sheet: null,
  post: null,
  screen: "glance",
  week: "",
  filter: "all",
}

const VIEWS: readonly PrototypeView[] = ["timbl", "interface", "mobile"]
const CANVAS: readonly CanvasVisibility[] = ["shown", "hidden", "expanded"]
const SHEETS: readonly SheetId[] = ["activity", "persona", "flyout", "talk", "rail", "nav", "notes", "peek", "approve-all"]
const SCREENS: readonly MobileScreen[] = ["glance", "approve", "chat"]
const FILTERS: readonly CalendarFilter[] = ["all", "drafts", "scheduled", "needs-approval", "sent"]

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

export function parseView(input: Input): ViewState {
  const get = reader(input)
  const sheet = get("sheet")
  return {
    view: pick(get("view"), VIEWS, DEFAULT_VIEW.view),
    canvas: pick(get("canvas"), CANVAS, DEFAULT_VIEW.canvas),
    sheet: sheet !== undefined && (SHEETS as readonly string[]).includes(sheet) ? (sheet as SheetId) : null,
    post: get("post") || null,
    screen: pick(get("screen"), SCREENS, DEFAULT_VIEW.screen),
    week: ISO_DATE.test(get("week") ?? "") ? (get("week") as string) : DEFAULT_VIEW.week,
    filter: pick(get("filter"), FILTERS, DEFAULT_VIEW.filter),
  }
}

export function serializeView(view: ViewState): string {
  const out: Record<string, string> = {}
  if (view.view !== DEFAULT_VIEW.view) out.view = view.view
  if (view.sheet) out.sheet = view.sheet
  if (view.canvas !== DEFAULT_VIEW.canvas) out.canvas = view.canvas
  if (view.post) out.post = view.post
  if (view.screen !== DEFAULT_VIEW.screen) out.screen = view.screen
  if (view.week) out.week = view.week
  if (view.filter !== DEFAULT_VIEW.filter) out.filter = view.filter
  return Object.keys(out)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(out[key])}`)
    .join("&")
}
