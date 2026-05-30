"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { ChevronDown, ChevronRight } from "lucide-react"

import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import {
  getAgentSession,
  type TimelineEventRow,
} from "@/lib/actions/agent-sessions"
import { getPostsByIds } from "@/lib/actions/posts"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { STATUS_TONE } from "./status-tone"
import { JsonHighlight, safeStringify } from "./json-pretty"
import { PublishChip } from "./publish-chip"

/*
 * Stepped timeline view of an agent run.
 *
 * Replaces the raw JSON `<pre>` block that the previous inspector shipped
 * with a thread of typed event rows: thoughts, content deltas, tool calls,
 * tool results, errors. Each row carries timestamp + dot glyph keyed to
 * type per DESIGN.md (ink filled / hollow / square / checkmark / red).
 *
 * Data fetched via `getAgentSession({ runId })`. Polled every 4s while the
 * run is in-flight so the timeline tails the live session; otherwise
 * fetched once with `staleTime: Infinity`.
 *
 * Metrics card at the top is sticky so duration / tokens / cost remain
 * visible as the user scrolls through long event logs.
 */

type Props = {
  run: AgentRunDoc
}

export function RunTimeline({ run }: Props) {
  const isLive = run.status === "in_progress" || run.status === "awaiting_human"

  const { data, isLoading } = useQuery({
    queryKey: ["studio", "run-session", run.id],
    queryFn: () => getAgentSession({ runId: run.id }),
    refetchInterval: isLive ? 4_000 : false,
    staleTime: isLive ? 0 : Infinity,
  })

  const events = data?.events ?? []
  const tokens = run.metrics.promptTokens + run.metrics.completionTokens

  const postIds = run.outputs.postIds ?? []
  const { data: posts } = useQuery({
    queryKey: ["studio", "posts", postIds.join(",")],
    queryFn: () => getPostsByIds({ ids: postIds }),
    enabled: postIds.length > 0,
    refetchInterval: 8_000,
    staleTime: 0,
  })
  const postMap = new Map((posts ?? []).map((p) => [p.id, p]))

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky metrics card */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="px-5 pt-5 pb-4">
          <SectionLabel>Run</SectionLabel>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h3 className="text-title-lg text-foreground truncate">
              {run.agentName}
            </h3>
            <Badge
              className={cn(
                "shrink-0 text-[11px] capitalize rounded-pill border-transparent",
                STATUS_TONE[run.status] ?? "",
              )}
            >
              {run.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] font-mono text-muted-foreground truncate">
            {run.id}
          </p>

          <dl className="mt-4 grid grid-cols-4 gap-3 text-[12px]">
            <Metric label="Duration">
              {run.durationMs != null
                ? `${(run.durationMs / 1000).toFixed(2)}s`
                : "-"}
            </Metric>
            <Metric label="LLM">{run.metrics.llmCalls.toString()}</Metric>
            <Metric label="Tools">{run.metrics.toolCalls.toString()}</Metric>
            <Metric label="Tokens">{tokens.toLocaleString()}</Metric>
            <Metric label="USD" className="col-span-2">
              ${run.metrics.usdCost.toFixed(4)}
            </Metric>
            <Metric label="Started" className="col-span-2">
              <span className="font-normal text-[11px]">
                {safeFmt(run.startedAt)}
              </span>
            </Metric>
          </dl>

          {run.outputs.postIds.length > 0 && (
            <div className="mt-4">
              <SectionLabel>Outputs</SectionLabel>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {run.outputs.postIds.map((id) => (
                  <li key={id}>
                    <PublishChip fallbackId={id} post={postMap.get(id)} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {run.inputSummary && (
            <p className="mt-4 text-[12px] text-muted-foreground line-clamp-2">
              {run.inputSummary}
            </p>
          )}

          {run.error && (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Error · {run.error.code}
              </p>
              <p className="mt-1 text-[12px] text-rose-900 dark:text-rose-200">
                {run.error.message}
              </p>
            </div>
          )}

          {isLive && (
            <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-secondary motion-safe:relative">
              <div className="h-full w-1/3 bg-foreground motion-safe:animate-[slide_1.4s_ease-in-out_infinite]" />
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 py-5">
        <SectionLabel>Timeline</SectionLabel>
        {isLoading && events.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">
            Loading events…
          </p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">
            No persisted events for this run. The run summary above shows
            everything we recorded.
          </p>
        ) : (
          <ol className="relative mt-3">
            {/* hairline rail */}
            <div
              aria-hidden
              className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-border"
            />
            {events.map((row) => (
              <TimelineRow key={row.key} row={row} />
            ))}
          </ol>
        )}
      </div>

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}

/* ---------------- one row ---------------- */

function TimelineRow({ row }: { row: TimelineEventRow }) {
  const ev = row.event

  if (ev.type === "content") {
    return (
      <Row row={row} dot={<DotInk />} label="Content" author={row.author}>
        <ContentBlock text={ev.content} />
      </Row>
    )
  }
  if (ev.type === "thought") {
    return (
      <Row row={row} dot={<DotHollow />} label="Thought" author={row.author}>
        <ContentBlock text={ev.content} muted />
      </Row>
    )
  }
  if (ev.type === "tool_call") {
    const name =
      (ev.call as { name?: string }).name ?? "tool"
    const args = (ev.call as { args?: unknown }).args
    return (
      <Row row={row} dot={<DotSquare />} label={`Tool · ${name}`} author={row.author}>
        <ExpandableJson title="Arguments" data={args} />
      </Row>
    )
  }
  if (ev.type === "tool_result") {
    const name =
      (ev.result as { name?: string }).name ?? "tool"
    const response = (ev.result as { response?: unknown }).response
    return (
      <Row row={row} dot={<DotCheck />} label={`Result · ${name}`} author={row.author}>
        <ExpandableJson title="Response" data={response} />
      </Row>
    )
  }
  if (ev.type === "error") {
    const message =
      (ev.error as { message?: string } | undefined)?.message ?? "Error"
    return (
      <Row row={row} dot={<DotError />} label="Error" author={row.author}>
        <p className="text-[12px] text-rose-700 dark:text-rose-300">
          {message}
        </p>
      </Row>
    )
  }
  if (ev.type === "activity") {
    return (
      <Row row={row} dot={<DotHollow />} label={`Activity · ${ev.kind}`} author={row.author}>
        <ExpandableJson title="Detail" data={ev.detail} />
      </Row>
    )
  }
  if (ev.type === "finished") {
    return (
      <Row row={row} dot={<DotCheck />} label="Finished" author={row.author}>
        {ev.output != null ? (
          <ExpandableJson title="Output" data={ev.output} />
        ) : null}
      </Row>
    )
  }
  // call_code / code_result / tool_confirmation - generic fallback.
  return (
    <Row row={row} dot={<DotHollow />} label={ev.type} author={row.author}>
      <ExpandableJson title="Payload" data={ev as unknown} />
    </Row>
  )
}

function Row({
  row,
  dot,
  label,
  author,
  children,
}: {
  row: TimelineEventRow
  dot: React.ReactNode
  label: string
  author?: string
  children?: React.ReactNode
}) {
  return (
    <li className="relative pl-6 pb-4 last:pb-0">
      <span className="absolute left-0 top-1 flex h-3 w-3 items-center justify-center">
        {dot}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
          {fmtTs(row.ts)}
        </span>
        <span className="text-[12px] font-medium text-foreground">{label}</span>
        {author && (
          <span className="text-[11px] text-muted-foreground">{author}</span>
        )}
      </div>
      {children && <div className="mt-1.5">{children}</div>}
    </li>
  )
}

/* ---------------- content block ---------------- */

const CONTENT_LINE_CAP = 6

function ContentBlock({ text, muted }: { text: string; muted?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const lines = text.split("\n")
  const isLong = lines.length > CONTENT_LINE_CAP
  const shown = expanded || !isLong ? text : lines.slice(0, CONTENT_LINE_CAP).join("\n")
  return (
    <div>
      <p
        className={cn(
          "text-[12px] whitespace-pre-wrap leading-relaxed",
          muted ? "text-muted-foreground italic" : "text-foreground",
        )}
      >
        {shown}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show less" : `Show more (${lines.length - CONTENT_LINE_CAP} more lines)`}
        </button>
      )}
    </div>
  )
}

/* ---------------- expandable JSON card ---------------- */

function ExpandableJson({
  title,
  data,
}: {
  title: string
  data: unknown
}) {
  const [open, setOpen] = useState(false)
  if (data == null) return null

  const json = safeStringify(data)
  const preview = json.length > 60 ? `${json.slice(0, 60)}…` : json

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
        )}
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {!open && (
          <span className="ml-1 text-[11px] font-mono text-muted-foreground truncate">
            {preview}
          </span>
        )}
      </button>
      {open && (
        <pre className="px-3 pb-3 text-[11px] font-mono leading-relaxed text-foreground/90 whitespace-pre-wrap break-words overflow-x-auto max-h-[280px]">
          <JsonHighlight json={json} />
        </pre>
      )}
    </div>
  )
}

/* ---------------- dots ---------------- */

function DotInk() {
  return <span className="size-2 rounded-full bg-foreground" aria-hidden />
}
function DotHollow() {
  return (
    <span
      aria-hidden
      className="size-2 rounded-full border border-muted-foreground/60 bg-background"
    />
  )
}
function DotSquare() {
  return <span className="size-2 rounded-sm bg-foreground" aria-hidden />
}
function DotCheck() {
  return (
    <span
      aria-hidden
      className="size-2.5 rounded-full bg-emerald-500 flex items-center justify-center"
    >
      <svg
        viewBox="0 0 8 8"
        className="size-2 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M1.5 4.25L3.25 6L6.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
function DotError() {
  return (
    <span className="size-2 rounded-full bg-rose-500" aria-hidden />
  )
}

/* ---------------- helpers ---------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

function Metric({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-[14px] font-semibold tabular-nums text-foreground">
        {children}
      </span>
    </div>
  )
}

function fmtTs(ms: number): string {
  if (!ms) return "-"
  try {
    return format(new Date(ms), "HH:mm:ss")
  } catch {
    return "-"
  }
}

function safeFmt(iso?: string): string {
  if (!iso) return "-"
  try {
    return format(parseISO(iso), "d MMM HH:mm:ss")
  } catch {
    return iso
  }
}

