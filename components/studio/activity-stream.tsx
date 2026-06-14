"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { CheckCircle2, History, Lightbulb } from "lucide-react"

import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { listAgentRuns } from "@/lib/actions/agent-runs"
import { listIdeationFeed } from "@/lib/actions/ideation"
import {
  listApprovalsLog,
  type ApprovalLogRow,
} from "@/lib/actions/approvals"
import {
  getPostsByIds,
  type PublishStatusProjection,
} from "@/lib/actions/posts"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import { STATUS_TONE } from "./status-tone"
import { ApprovalCard } from "./approval-card"
import { PublishChip } from "./publish-chip"

/*
 * Activity stream - live polling feed of recent agent runs.
 *
 * Phase B replaces the static Phase A render with a TanStack-Query poll
 * (4s cadence). Server hydrates the first page via `initialRuns`, so the
 * paint is instant and the poll only kicks in client-side.
 *
 * Filter chips at the top use Cal.com `category-tab` styling (transparent
 * default, canvas-filled pill when active). State is mirrored to the URL
 * via `?filter=` so the view is shareable.
 *
 * Rows that appear after the initial render fade in (Tailwind animate-in,
 * gated by `motion-safe:`). In-flight runs show a live token ticker, a
 * USD cost ticker, and an indeterminate progress strip - these
 * auto-update because the underlying query refetches every 4s.
 */

type Props = {
  initialRuns: AgentRunDoc[]
  initialIdeation?: IdeationItem[]
  initialApprovals?: ApprovalLogRow[]
}

/* Compact row shape for ideation items that surface alongside runs. */
type IdeationRow = {
  kind: "ideation"
  id: string
  createdAt: string
  item: IdeationItem
}
type RunRowKind = {
  kind: "run"
  id: string
  createdAt: string
  run: AgentRunDoc
}
type ApprovalRowKind = {
  kind: "approval"
  id: string
  createdAt: string
  entry: ApprovalLogRow
}
type FeedRow = RunRowKind | IdeationRow | ApprovalRowKind

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "awaiting", label: "Awaiting approval" },
  { key: "failed", label: "Failed" },
  { key: "succeeded", label: "Succeeded" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

function isFilterKey(s: string | null): s is FilterKey {
  return !!s && FILTERS.some((f) => f.key === s)
}

function matchesFilter(run: AgentRunDoc, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true
    case "live":
      return run.status === "in_progress"
    case "awaiting":
      return run.status === "awaiting_human"
    case "failed":
      return run.status === "failed" || run.status === "cancelled"
    case "succeeded":
      return run.status === "succeeded"
  }
}

export function ActivityStream({
  initialRuns,
  initialIdeation = [],
  initialApprovals = [],
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const focus = params.get("focus") ?? ""
  const selectedRun = focus.startsWith("run:") ? focus.slice(4) : null
  const selectedIdeation = focus.startsWith("ideation:") ? focus.slice(9) : null

  const rawFilter = params.get("filter")
  const filter: FilterKey = isFilterKey(rawFilter) ? rawFilter : "all"

  const { data } = useQuery({
    queryKey: ["studio", "runs"],
    queryFn: () => listAgentRuns({ limit: 50 }),
    refetchInterval: 4_000,
    initialData: initialRuns,
    staleTime: 0,
  })
  const runs = data ?? initialRuns

  const { data: ideationData } = useQuery({
    queryKey: ["ideation", "new"],
    queryFn: () => listIdeationFeed({ status: "new" }),
    refetchInterval: 8_000,
    initialData: initialIdeation,
    staleTime: 0,
  })
  const ideation = ideationData ?? initialIdeation

  const { data: approvalsData } = useQuery({
    queryKey: ["studio", "approvals"],
    queryFn: () => listApprovalsLog({ limit: 50 }),
    refetchInterval: 8_000,
    initialData: initialApprovals,
    staleTime: 0,
  })
  const approvals = approvalsData ?? initialApprovals

  /* Dedupe postIds across visible runs and fetch their publish state in one
   * batched call so the chip strip on each run card costs us a single read
   * per refresh instead of N. Cap at 30 to match the action's bound. */
  const postIds = useMemo(() => {
    const set = new Set<string>()
    for (const r of runs) {
      for (const id of r.outputs?.postIds ?? []) set.add(id)
    }
    return Array.from(set).slice(0, 30)
  }, [runs])

  const { data: postMapData } = useQuery({
    queryKey: ["studio", "posts", postIds.join(",")],
    queryFn: () => getPostsByIds({ ids: postIds }),
    enabled: postIds.length > 0,
    refetchInterval: 8_000,
    staleTime: 0,
  })

  const postMap = useMemo(() => {
    const m = new Map<string, PublishStatusProjection>()
    for (const p of postMapData ?? []) m.set(p.id, p)
    return m
  }, [postMapData])

  /* Track which ids have been seen so newly-arriving rows fade in.
   *
   * We seed the set from the server-hydrated initial list so the first
   * paint is never animated; subsequent polls compare against the set
   * (read during render) and commit the new ids inside an effect.
   *
   * This is a deliberate "render-then-commit" use of a ref: reading the
   * Set during render is safe because the ref is only updated in an
   * effect after commit, and we never branch component identity off it.
   * The eslint rule that flags ref reads during render is a heuristic,
   * not a correctness rule - and the safer alternative (setState in an
   * effect) trips a different eslint rule. We opt out locally. */
  const seenRef = useRef<Set<string>>(
    new Set<string>([
      ...initialRuns.map((r) => r.id),
      ...initialIdeation.map((i) => i.id),
      ...initialApprovals.map((a) => a.id),
    ]),
  )
  useEffect(() => {
    const set = seenRef.current
    for (const r of runs) set.add(r.id)
    for (const i of ideation) set.add(i.id)
    for (const a of approvals) set.add(a.id)
  }, [runs, ideation, approvals])

  const filtered = useMemo<FeedRow[]>(() => {
    const runRows: RunRowKind[] = runs
      .filter((r) => matchesFilter(r, filter))
      .map((r) => ({
        kind: "run",
        id: r.id,
        createdAt: r.startedAt ?? r.createdAt ?? "",
        run: r,
      }))
    // Ideation + approval entries surface only on the All filter - for the
    // focused filters (live / awaiting / failed / succeeded) the activity is
    // purely run-status oriented and a mixed feed would confuse those views.
    const ideationRows: IdeationRow[] =
      filter === "all"
        ? ideation.map((i) => ({
            kind: "ideation",
            id: i.id,
            createdAt: i.createdAt ?? "",
            item: i,
          }))
        : []
    const approvalRows: ApprovalRowKind[] =
      filter === "all"
        ? approvals
            /* Skip reverted entries - the undo restored prior state, so
             * showing the row is just noise. */
            .filter((a) => a.revertedAt === null)
            .map((a) => ({
              kind: "approval",
              id: a.id,
              createdAt: a.createdAt,
              entry: a,
            }))
        : []
    // Pull awaiting-approval run cards to the top; everything else sorts
    // by createdAt desc.
    const pending: FeedRow[] = []
    const rest: FeedRow[] = []
    for (const row of [...runRows, ...ideationRows, ...approvalRows]) {
      if (row.kind === "run" && row.run.status === "awaiting_human") {
        pending.push(row)
      } else {
        rest.push(row)
      }
    }
    pending.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    rest.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return [...pending, ...rest]
  }, [runs, ideation, approvals, filter])

  function setFilter(next: FilterKey) {
    const sp = new URLSearchParams(params.toString())
    if (next === "all") sp.delete("filter")
    else sp.set("filter", next)
    const qs = sp.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  function selectRun(id: string) {
    const next = new URLSearchParams(params.toString())
    if (selectedRun === id) {
      next.delete("focus")
    } else {
      next.set("focus", `run:${id}`)
    }
    const qs = next.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  function selectIdeation(id: string) {
    const next = new URLSearchParams(params.toString())
    if (selectedIdeation === id) {
      next.delete("focus")
    } else {
      next.set("focus", `ideation:${id}`)
    }
    const qs = next.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: runs.length,
      live: 0,
      awaiting: 0,
      failed: 0,
      succeeded: 0,
    }
    for (const r of runs) {
      if (r.status === "in_progress") c.live++
      if (r.status === "awaiting_human") c.awaiting++
      if (r.status === "failed" || r.status === "cancelled") c.failed++
      if (r.status === "succeeded") c.succeeded++
    }
    return c
  }, [runs])

  return (
    <section className="px-4 sm:px-6 py-4 sm:py-6">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-title-md text-foreground">Activity</h2>
        <p className="text-caption text-muted-foreground tabular-nums">
          {filtered.length} of {runs.length}
        </p>
      </header>

      {/* Filter chip row - Cal.com category-tab styling */}
      <div className="mb-4 max-w-full overflow-x-auto no-scrollbar">
        <div className="inline-flex min-w-max items-center gap-0.5 rounded-pill bg-secondary p-0.5">
        {FILTERS.map((f) => {
          const active = f.key === filter
          const count = counts[f.key]
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] transition-colors",
                active
                  ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,.05)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="tabular-nums text-[11px] opacity-70">
                {count}
              </span>
            </button>
          )
        })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title={
            filter === "all"
              ? "No agent runs yet"
              : `No ${labelFor(filter).toLowerCase()} runs`
          }
          body={
            filter === "all"
              ? "Trigger a run from /studio (or the agent drawer) to populate the activity stream."
              : "Switch filter to see other runs."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {/* eslint-disable-next-line react-hooks/refs */}
          {filtered.map((row) => {
            const isNew = !seenRef.current.has(row.id)
            if (row.kind === "approval") {
              return (
                <li
                  key={`a:${row.id}`}
                  className={cn(
                    isNew &&
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300",
                  )}
                >
                  <ApprovalRowView entry={row.entry} />
                </li>
              )
            }
            if (row.kind === "ideation") {
              const active = selectedIdeation === row.id
              return (
                <li
                  key={`i:${row.id}`}
                  className={cn(
                    isNew &&
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300",
                  )}
                >
                  <IdeationRow
                    item={row.item}
                    active={active}
                    onSelect={() => selectIdeation(row.id)}
                  />
                </li>
              )
            }
            const run = row.run
            const active = selectedRun === run.id
            if (run.status === "awaiting_human") {
              return (
                <li
                  key={`r:${run.id}`}
                  className={cn(
                    isNew &&
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300",
                  )}
                >
                  <ApprovalCard
                    run={run}
                    active={active}
                    onSelect={() => selectRun(run.id)}
                  />
                </li>
              )
            }
            return (
              <li
                key={`r:${run.id}`}
                className={cn(
                  isNew &&
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300",
                )}
              >
                <RunRow
                  run={run}
                  active={active}
                  onSelect={() => selectRun(run.id)}
                  postMap={postMap}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RunRow({
  run,
  active,
  onSelect,
  postMap,
}: {
  run: AgentRunDoc
  active: boolean
  onSelect: () => void
  postMap: Map<string, PublishStatusProjection>
}) {
  const tokens = run.metrics.promptTokens + run.metrics.completionTokens
  const isLive = run.status === "in_progress"
  const needsApproval = run.status === "awaiting_human"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-lg border bg-background px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
        active
          ? "border-foreground/30 bg-secondary/40"
          : needsApproval
            ? "border-orange-200 dark:border-orange-900 hover:bg-secondary/30"
            : "border-border hover:bg-secondary/30",
      )}
      aria-pressed={active}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {run.agentName}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wide rounded-pill border-border bg-background text-muted-foreground capitalize"
          >
            {run.trigger}
          </Badge>
          <Badge
            className={cn(
              "text-[11px] capitalize rounded-pill border-transparent",
              STATUS_TONE[run.status] ?? "",
            )}
          >
            {run.status.replace("_", " ")}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums sm:ml-auto">
          <span>{relTime(run.startedAt)}</span>
          <span>{tokens.toLocaleString()} tok</span>
          {isLive && (
            <span className="text-foreground">
              ${run.metrics.usdCost.toFixed(4)}
            </span>
          )}
        </div>
      </div>
      {run.inputSummary && (
        <p className="mt-1.5 text-[13px] text-muted-foreground line-clamp-1">
          {run.inputSummary}
        </p>
      )}

      {run.outputs?.postIds && run.outputs.postIds.length > 0 && (
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {run.outputs.postIds.slice(0, 6).map((id) => (
            <PublishChip key={id} fallbackId={id} post={postMap.get(id)} />
          ))}
          {run.outputs.postIds.length > 6 && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              +{run.outputs.postIds.length - 6} more
            </span>
          )}
        </div>
      )}

      {/* Indeterminate progress strip for in-flight runs */}
      {isLive && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden bg-secondary"
        >
          <span className="block h-full w-1/3 bg-foreground motion-safe:animate-[slide_1.4s_ease-in-out_infinite] motion-reduce:opacity-60" />
        </span>
      )}

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}

function IdeationRow({
  item,
  active,
  onSelect,
}: {
  item: IdeationItem
  active: boolean
  onSelect: () => void
}) {
  const confidencePct = Math.round(item.confidence * 100)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full overflow-hidden rounded-lg border bg-background px-4 py-3 text-left transition-colors",
        active
          ? "border-foreground/30 bg-secondary/40"
          : "border-border hover:bg-secondary/30",
      )}
      aria-pressed={active}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden
            className="size-6 shrink-0 rounded-md bg-secondary flex items-center justify-center"
          >
            <Lightbulb className="size-3.5 text-foreground" />
          </span>
          <span className="text-sm font-semibold text-foreground truncate">
            {item.title}
          </span>
          <Badge
            variant="outline"
            className="shrink-0 text-[10px] uppercase tracking-wide rounded-pill border-border bg-background text-muted-foreground"
          >
            Idea
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums sm:shrink-0">
          <span>{confidencePct}%</span>
          <span>{relTime(item.createdAt)}</span>
        </div>
      </div>
      {item.summary && (
        <p className="mt-1.5 text-[13px] text-muted-foreground line-clamp-1">
          {item.summary}
        </p>
      )}
    </button>
  )
}

function labelFor(k: FilterKey): string {
  return FILTERS.find((f) => f.key === k)?.label ?? "All"
}

function ApprovalRowView({ entry }: { entry: ApprovalLogRow }) {
  const label = approvalLabel(entry)
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-background px-4 py-3 text-left",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden
            className="size-6 shrink-0 rounded-md bg-secondary flex items-center justify-center"
          >
            <CheckCircle2 className="size-3.5 text-foreground" />
          </span>
          <span className="text-sm font-semibold text-foreground truncate">
            {label}
          </span>
          <Badge
            variant="outline"
            className="shrink-0 text-[10px] uppercase tracking-wide rounded-pill border-border bg-background text-muted-foreground"
          >
            Approved
          </Badge>
          {entry.sourceAgent ? (
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[10px] tracking-wide rounded-pill border-border bg-background text-muted-foreground"
            >
              via {entry.sourceAgent}
            </Badge>
          ) : null}
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums sm:shrink-0">
          {relTime(entry.createdAt)}
        </span>
      </div>
    </div>
  )
}

function approvalLabel(entry: ApprovalLogRow): string {
  switch (entry.nextActionKind) {
    case "schedule_post":
      return "Post scheduled"
    case "add_to_calendar":
      return "Added to calendar"
    case "create_draft":
      return "Draft created"
    case "instantiate_template":
      return "Template instantiated"
    case "assign_review":
      return "Assigned for review"
    case "regenerate":
      return "Regenerated"
    case "noop":
      return "Approved"
    default:
      return "Approved"
  }
}

function relTime(iso: string | undefined): string {
  if (!iso) return "-"
  try {
    const d = parseISO(iso)
    const distance = formatDistanceToNow(d, { addSuffix: true })
    return distance.replace(/^about /, "")
  } catch {
    try {
      return format(parseISO(iso), "d MMM HH:mm")
    } catch {
      return iso
    }
  }
}

