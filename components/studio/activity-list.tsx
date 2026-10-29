"use client"

import { useId, useMemo, useRef, useState } from "react"
import { CheckCircle2, History } from "lucide-react"

import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { ApprovalLogRow } from "@/lib/actions/approvals"
import { cn } from "@/lib/utils"
import { ShowMore } from "@/components/ui/disclosure"
import { RUN_STATUS_COPY, agentLabel } from "./agent-meta"
import { StatusDot, ago } from "./bits"
import { Section } from "./section"

const VERB: Record<string, string> = {
  queued: "is queued",
  in_progress: "is working",
  awaiting_human: "is waiting for you",
  succeeded: "finished",
  failed: "failed",
  cancelled: "was cancelled",
}

const APPROVAL_COPY: Record<string, string> = {
  schedule_post: "Post scheduled",
  add_to_calendar: "Added to calendar",
  create_draft: "Draft created",
  instantiate_template: "Template applied",
  assign_review: "Sent for review",
  regenerate: "Regenerated",
}

type Filter = "all" | "running" | "failed"

type Row =
  | { kind: "run"; id: string; at: string; run: AgentRunDoc }
  | { kind: "approval"; id: string; at: string; entry: ApprovalLogRow }

type Props = {
  runs: AgentRunDoc[]
  approvals?: ApprovalLogRow[]
  onOpenRun: (id: string) => void
  title?: string
  limit?: number
  compact?: boolean
  filterable?: boolean
  sectionId?: string
  hideAgent?: boolean
}

export function ActivityList({
  runs,
  approvals = [],
  onOpenRun,
  title = "Activity",
  limit = 8,
  compact,
  filterable = true,
  sectionId = "activity",
  hideAgent,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [expanded, setExpanded] = useState(false)

  const counts = useMemo(
    () => ({
      all: runs.length + approvals.length,
      running: runs.filter((r) => r.status === "in_progress" || r.status === "queued").length,
      failed: runs.filter((r) => r.status === "failed").length,
    }),
    [runs, approvals],
  )

  const rows = useMemo<Row[]>(() => {
    const runRows: Row[] = runs
      .filter((r) =>
        filter === "running"
          ? r.status === "in_progress" || r.status === "queued"
          : filter === "failed"
            ? r.status === "failed"
            : true,
      )
      .map((r) => ({ kind: "run", id: r.id, at: r.startedAt ?? r.createdAt ?? "", run: r }))
    const approvalRows: Row[] =
      filter === "all"
        ? approvals
            .filter((a) => a.revertedAt === null)
            .map((a) => ({ kind: "approval", id: a.id, at: a.createdAt, entry: a }))
        : []
    return [...runRows, ...approvalRows].sort((a, b) => (a.at < b.at ? 1 : -1))
  }, [runs, approvals, filter])

  const listId = useId()
  const listRef = useRef<HTMLOListElement>(null)
  const firstRevealed = () => {
    const row = listRef.current?.children[limit] as HTMLElement | undefined
    return row?.querySelector<HTMLElement>("button") ?? row
  }

  const visible = expanded ? rows : rows.slice(0, limit)
  const filters = (["all", "running", "failed"] as const).filter(
    (f) => f === "all" || counts[f] > 0 || filter === f,
  )

  return (
    <Section
      id={sectionId}
      title={title}
      summary={[counts.running > 0 && `${counts.running} running`, counts.failed > 0 && `${counts.failed} failed`].filter(Boolean).join(" · ") || undefined}
      action={
          filterable && filters.length > 1 ? (
            <div role="tablist" aria-label="Filter activity" className="flex items-center gap-1">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[12px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    filter === f
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                  {f !== "all" && <span className="ml-1 tabular-nums opacity-70">{counts[f]}</span>}
                </button>
              ))}
            </div>
          ) : undefined
        }
    >
      <div className="space-y-2">

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <History className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-[14px] font-medium text-foreground">No activity yet</p>
          <p className="max-w-[36ch] text-[13px] text-muted-foreground">
            Runs show up here as your agents work. Open an agent to chat with it or run it now.
          </p>
        </div>
      ) : (
        <ol id={listId} ref={listRef} className={cn("relative", !compact && "rounded-xl border border-border")}>
          {visible.map((row, i) => (
            <li
              key={`${row.kind}:${row.id}`}
              tabIndex={i === limit ? -1 : undefined}
              className={cn(i > 0 && "border-t border-border")}
            >
              {row.kind === "run" ? (
                <RunLine run={row.run} onOpen={() => onOpenRun(row.run.id)} compact={compact} hideAgent={hideAgent} />
              ) : (
                <ApprovalLine entry={row.entry} compact={compact} />
              )}
            </li>
          ))}
        </ol>
      )}

      {rows.length > limit && (
        <ShowMore
          expanded={expanded}
          onExpandedChange={setExpanded}
          hiddenCount={rows.length - limit}
          controls={listId}
          focusTarget={firstRevealed}
          className="w-full justify-center rounded-lg py-2 text-[13px] hover:bg-secondary/50"
        />
      )}
      </div>
    </Section>
  )
}

function RunLine({
  run,
  onOpen,
  compact,
  hideAgent,
}: {
  run: AgentRunDoc
  onOpen: () => void
  compact?: boolean
  hideAgent?: boolean
}) {
  const status = RUN_STATUS_COPY[run.status] ?? RUN_STATUS_COPY.queued
  const posts = run.outputs?.postIds?.length ?? 0
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        compact ? "px-1 py-2.5" : "px-4 py-3",
      )}
    >
      <span className="mt-1.5">
        <StatusDot className={status.dot} pulse={run.status === "in_progress"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-foreground">
          {hideAgent ? (
            <span className="font-medium">{status.label}</span>
          ) : (
            <>
              <span className="font-medium">{agentLabel(run.agentName)}</span>{" "}
              <span className="text-muted-foreground">{VERB[run.status] ?? run.status}</span>
            </>
          )}
          {posts > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {posts} {posts === 1 ? "post" : "posts"}
            </span>
          )}
        </span>
        {run.inputSummary && (
          <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{run.inputSummary}</span>
        )}
      </span>
      <time className="shrink-0 pt-px text-[12px] tabular-nums text-muted-foreground">{ago(run.startedAt)}</time>
    </button>
  )
}

function ApprovalLine({ entry, compact }: { entry: ApprovalLogRow; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3", compact ? "px-1 py-2.5" : "px-4 py-3")}>
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px]">
        <span className="font-medium text-foreground">
          {APPROVAL_COPY[entry.nextActionKind ?? ""] ?? "Approved"}
        </span>
        {entry.sourceAgent && (
          <span className="text-muted-foreground"> · from {agentLabel(entry.sourceAgent)}</span>
        )}
      </span>
      <time className="shrink-0 pt-px text-[12px] tabular-nums text-muted-foreground">{ago(entry.createdAt)}</time>
    </div>
  )
}
