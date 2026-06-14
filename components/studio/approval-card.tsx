"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Check, Loader2, X, Pencil } from "lucide-react"
import { toast } from "sonner"

import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import { getAgentSession } from "@/lib/actions/agent-sessions"
import { resolveHumanGate } from "@/lib/actions/agent-suggestions"
import { revertApproval } from "@/lib/actions/approvals"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/*
 * Approval card - rendered in the activity stream when a run is in
 * `awaiting_human`. Pulls the requestHumanApproval tool_call's args out
 * of the session event log so it can show the actual question the gate
 * is blocking on, plus the postId for context.
 *
 * Approve / Edit & approve / Reject all dispatch through
 * `resolveHumanGate({ runId, decision, comment? })` which locates the
 * postId via the same session-events lookup server-side and delegates
 * to the unified `approveItem` dispatcher (which writes an approvalsLog
 * entry) and fires /api/agents/runs/{runId}/resume so the pipeline
 * finishes. On approve, the success toast carries a 5-second Undo that
 * reverses the side-effect via `revertApproval`.
 *
 * Visual: surface-card body, left ink-orange accent strip, no shadow.
 */

type Props = {
  run: AgentRunDoc
  active: boolean
  onSelect: () => void
}

export function ApprovalCard({ run, active, onSelect }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState("")

  /* Probe the session event log for the most recent requestHumanApproval
   * tool_call. Cached per-runId so multiple approval cards rendering
   * the same run don't fan out into multiple reads. */
  const { data: session } = useQuery({
    queryKey: ["studio", "session", run.id],
    queryFn: () => getAgentSession({ runId: run.id, limit: 1_000 }),
    staleTime: 30_000,
  })

  const gate = extractGate(session?.events)

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
    queryClient.invalidateQueries({ queryKey: ["studio", "session", run.id] })
    queryClient.invalidateQueries({ queryKey: ["posts"] })
  }

  function act(decision: "approve" | "reject", commentArg?: string) {
    startTransition(async () => {
      const res = await resolveHumanGate({
        runId: run.id,
        decision,
        comment: commentArg,
      })
      if (!res.ok) {
        toast.error("Failed", { description: res.error })
        return
      }
      if (decision === "approve") {
        const logId = res.approvalLogId
        toast.success(approvedTitle(res.nextActionKind), {
          duration: 5_000,
          action: logId
            ? {
                label: "Undo",
                onClick: () => {
                  revertApproval({ approvalLogId: logId }).then((r) => {
                    if (r.ok) {
                      toast.message("Approval reverted")
                      invalidateAll()
                    } else {
                      toast.error("Couldn't undo", { description: r.error })
                    }
                  })
                },
              }
            : undefined,
        })
      } else {
        toast.success("Rejected")
      }
      if (res.resumeRunId && res.resumeToolCallId) {
        fetch(`/api/agents/runs/${res.resumeRunId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolCallId: res.resumeToolCallId,
            approved: decision === "approve",
            feedback: commentArg ?? "",
          }),
        }).catch(() => {
          /* surfaced via the run timeline if it fails */
        })
      }
      invalidateAll()
      setEditing(false)
      setComment("")
    })
  }

  function viewRun(e: React.MouseEvent) {
    e.stopPropagation()
    const sp = new URLSearchParams(params.toString())
    sp.set("focus", `run:${run.id}`)
    router.replace(`/studio?${sp.toString()}`, { scroll: false })
  }

  const body = gate?.summary ?? run.inputSummary ?? "Awaiting your review."

  return (
    <div
      role="group"
      aria-label={`Approval required for ${run.agentName}`}
      className={cn(
        "relative overflow-hidden rounded-lg bg-surface-card",
        active && "ring-1 ring-foreground/20",
      )}
    >
      {/* Left accent strip - badge-orange, 3px */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] bg-badge-orange"
      />

      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-5 py-5 pl-6 block"
        aria-pressed={active}
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {run.agentName}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-badge-orange font-medium">
            Awaiting approval
          </span>
          <span className="flex-1" />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {relTime(run.startedAt)}
          </span>
        </div>
        <p className="mt-2 text-[13px] text-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">
          {body}
        </p>
        {gate?.postId && (
          <p className="mt-1.5 text-[11px] font-mono text-muted-foreground truncate">
            post · {gate.postId}
          </p>
        )}
      </button>

      <div className="px-5 pl-6 pb-4 -mt-1 flex flex-col gap-2.5">
        {editing && (
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note for the agent (optional)…"
            rows={2}
            className="bg-background"
            aria-label="Approval comment"
          />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            size="sm"
            onClick={() => act("approve", editing ? comment.trim() || undefined : undefined)}
            disabled={pending}
            aria-label="Approve"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-3.5" aria-hidden />
            )}
            {editing ? "Approve with note" : "Approve"}
          </Button>
          {!editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={pending}
              aria-label="Edit and approve"
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit & approve
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => act("reject", editing ? comment.trim() || undefined : undefined)}
            disabled={pending}
            className="text-rose-700 dark:text-rose-300"
            aria-label="Reject"
          >
            <X className="size-3.5" aria-hidden />
            Reject
          </Button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setComment("")
              }}
              className="text-[12px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          )}
          <span className="hidden sm:block sm:flex-1" />
          <button
            type="button"
            onClick={viewRun}
            className="text-[12px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline text-left"
          >
            View full run
          </button>
        </div>
      </div>
    </div>
  )
}

type SessionEvents = NonNullable<
  Awaited<ReturnType<typeof getAgentSession>>["events"]
>

function extractGate(
  events: SessionEvents | undefined,
): { postId?: string; summary?: string } | null {
  if (!events) return null
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i].event
    if (ev.type !== "tool_call") continue
    const call = ev.call as { name?: string; args?: unknown } | undefined
    if (!call || call.name !== "requestHumanApproval") continue
    const args = (call.args ?? {}) as { postId?: string; summary?: string }
    return { postId: args.postId, summary: args.summary }
  }
  return null
}

function approvedTitle(kind: string | undefined): string {
  switch (kind) {
    case "schedule_post":
      return "Approved & scheduled"
    case "add_to_calendar":
      return "Approved & added to calendar"
    case "create_draft":
      return "Approved - draft created"
    case "instantiate_template":
      return "Approved - template applied"
    case "assign_review":
      return "Approved & assigned"
    default:
      return "Approved"
  }
}

function relTime(iso: string | undefined): string {
  if (!iso) return "-"
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true }).replace(
      /^about /,
      "",
    )
  } catch {
    return iso
  }
}
