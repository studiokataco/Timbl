"use client"

import { useEffect, useId, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react"

import { DisclosureBody, DisclosureTrigger, useRemembered } from "@/components/ui/disclosure"
import { cn } from "@/lib/utils"

interface PanelStep {
  id: string
  startedAt: number
  finishedAt?: number
  error?: string
  result?: unknown
}

interface AgentPlanPanelProps {
  steps: PanelStep[]
  isStreaming: boolean
  children: React.ReactNode
}

export function AgentPlanPanel({
  steps,
  isStreaming,
  children,
}: AgentPlanPanelProps) {
  const total = steps.length
  const pending = steps.filter((s) => s.result === undefined && !s.error).length
  const errored = steps.filter((s) => Boolean(s.error)).length

  const status: "running" | "failed" | "done" = isStreaming || pending > 0
    ? "running"
    : errored > 0
      ? "failed"
      : "done"

  const [preferOpen, setPreferOpen] = useRemembered("agent.plan", true)
  const [autoCollapsed, setAutoCollapsed] = useState(false)
  const open = preferOpen && !autoCollapsed
  const setOpen = (v: boolean) => {
    setAutoCollapsed(false)
    setPreferOpen(v)
  }
  const bodyId = useId()
  useRunStopCollapse(isStreaming, pending, setAutoCollapsed)

  const earliest = steps.reduce(
    (acc, s) => (acc === 0 || s.startedAt < acc ? s.startedAt : acc),
    0,
  )
  const latest = steps.reduce(
    (acc, s) => Math.max(acc, s.finishedAt ?? s.startedAt),
    0,
  )
  const durationS =
    earliest && latest && latest >= earliest
      ? ((latest - earliest) / 1000).toFixed(1)
      : null

  const stepLabel = total === 1 ? "1 step" : `${total} steps`
  const statusLabel =
    status === "running"
      ? pending > 0
        ? `running · ${total - pending}/${total}`
        : "running"
      : status === "failed"
        ? `failed · ${errored} of ${total}`
        : durationS
          ? `done · ${durationS}s`
          : "done"

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <DisclosureTrigger
        open={open}
        onOpenChange={setOpen}
        controls={bodyId}
        chevronClassName="size-3.5"
        className="gap-3 px-3 py-2.5 hover:bg-secondary/40"
      >
        <span
          aria-hidden
          className="size-6 shrink-0 rounded-md bg-secondary flex items-center justify-center"
        >
          {status === "running" ? (
            <Loader2 className="size-3.5 text-foreground motion-safe:animate-spin" />
          ) : status === "failed" ? (
            <AlertCircle className="size-3.5 text-rose-600" />
          ) : (
            <CheckCircle2 className="size-3.5 text-foreground" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-foreground truncate">
              Plan
            </span>
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {stepLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {status === "failed" && (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-rose-500 shrink-0"
              />
            )}
            <span
              className={cn(
                "text-[11px] truncate",
                status === "failed"
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-muted-foreground",
              )}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </DisclosureTrigger>
      <DisclosureBody
        id={bodyId}
        open={open}
        className="border-t border-border px-3 py-2.5 flex flex-col gap-2"
      >
        {children}
      </DisclosureBody>
    </div>
  )
}

function useRunStopCollapse(
  isStreaming: boolean,
  pending: number,
  setCollapsed: (v: boolean) => void,
) {
  const collapsedOnce = useRef(false)
  useEffect(() => {
    if (!isStreaming && pending === 0 && !collapsedOnce.current) {
      collapsedOnce.current = true
      setCollapsed(true)
    }
  }, [isStreaming, pending, setCollapsed])
}
