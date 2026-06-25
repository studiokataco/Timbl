"use client"

import { useState, useTransition } from "react"
import { Check, Loader2, RefreshCw, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { approveAgentDraft, rejectAgentDraft } from "@/lib/actions/agent-suggestions"
import { revertApproval } from "@/lib/actions/approvals"
import {
  REJECT_REASON_LABELS,
  REJECT_REASONS,
  type NextAction,
  type NextActionKind,
  type RejectReason,
} from "@/lib/schemas/_shared"

/*
 * Approve/Reject controls rendered on any kanban card whose
 * agentMeta.reviewState === 'pending'.
 *
 * The Approve button label is contextual - it reflects the post's
 * declared `nextAction.kind` so the user knows what will happen:
 *   - schedule_post     → "Approve & schedule"
 *   - add_to_calendar   → "Approve & add to calendar"
 *   - create_draft      → "Approve & open in composer"
 *   - instantiate_template → "Approve & create from template"
 *   - regenerate / assign_review / noop → "Approve"
 *
 * On success: sonner toast surfaces a "View →" link to the artifact + a
 * 5-second "Undo" that calls revertApproval to reverse the side-effect.
 *
 * Reject opens a small popover with canned reasons + an optional note
 * + a "Regenerate with feedback" toggle that sends the rationale back to
 * the originating agent.
 */

const APPROVE_LABEL: Record<NextActionKind, string> = {
  schedule_post: "Approve & schedule",
  add_to_calendar: "Approve & add to calendar",
  create_draft: "Approve & open in composer",
  instantiate_template: "Approve & create from template",
  assign_review: "Approve & assign",
  regenerate: "Approve",
  noop: "Approve",
}

type Props = {
  postId: string
  nextAction?: NextAction
  className?: string
  /* Compact = icon-only primary, used on dense kanban cards. */
  compact?: boolean
}

export function ApprovalActions({
  postId,
  nextAction,
  className,
  compact,
}: Props) {
  const kind = nextAction?.kind ?? "noop"
  const [pending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState<RejectReason | null>(null)
  const [note, setNote] = useState("")
  const queryClient = useQueryClient()

  /* Flip the cached post out of "pending" review immediately so the card's
   * Approve/Reject controls disappear without waiting on the refetch. The
   * subsequent invalidate reconciles against the server. */
  function patchReviewState(state: "approved" | "rejected") {
    queryClient.setQueriesData<{ id: string; agentMeta?: Record<string, unknown> }[]>(
      { queryKey: ["posts"] },
      (curr) =>
        curr?.map((p) =>
          p.id === postId
            ? { ...p, agentMeta: { ...p.agentMeta, reviewState: state } }
            : p,
        ),
    )
  }

  function approve() {
    startTransition(async () => {
      const res = await approveAgentDraft({ postId })
      if (!res.ok) {
        toast.error("Couldn't approve", { description: res.error })
        return
      }
      patchReviewState("approved")
      queryClient.invalidateQueries({ queryKey: ["posts"] })
      queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
      /* Toast with Undo. Sonner's `action` is the standard slot for
       * one-shot affordances; 5s window matches the plan. */
      toast.success(approvedToastTitle(kind), {
        duration: 5_000,
        action: res.approvalLogId
          ? {
              label: "Undo",
              onClick: () => {
                if (!res.approvalLogId) return
                revertApproval({ approvalLogId: res.approvalLogId }).then((r) => {
                  if (r.ok) {
                    toast.message("Approval reverted")
                    queryClient.invalidateQueries({ queryKey: ["posts"] })
                  } else {
                    toast.error("Couldn't undo", { description: r.error })
                  }
                })
              },
            }
          : undefined,
      })
      /* Resume the paused run if any (preserves prior behavior). */
      if (res.resumeRunId && res.resumeToolCallId) {
        fetch(`/api/agents/runs/${res.resumeRunId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolCallId: res.resumeToolCallId,
            approved: true,
          }),
        }).catch(() => {
          /* surfaced in /settings/runs if it fails */
        })
      }
    })
  }

  function submitReject(regenerate: boolean) {
    startTransition(async () => {
      const res = await rejectAgentDraft({
        postId,
        reason: reason ?? undefined,
        reasonNote: note.trim() || undefined,
        regenerate,
      })
      if (!res.ok) {
        toast.error("Couldn't reject", { description: res.error })
        return
      }
      patchReviewState("rejected")
      queryClient.invalidateQueries({ queryKey: ["posts"] })
      toast.success(regenerate ? "Sent back for regeneration" : "Rejected")
      setRejectOpen(false)
      setReason(null)
      setNote("")
      if (res.resumeRunId && res.resumeToolCallId) {
        fetch(`/api/agents/runs/${res.resumeRunId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolCallId: res.resumeToolCallId,
            approved: false,
            feedback: composeFeedback(reason, note),
          }),
        }).catch(() => {})
      }
    })
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full justify-center px-2 text-xs"
        onClick={approve}
        disabled={pending}
        aria-label={APPROVE_LABEL[kind]}
        title={APPROVE_LABEL[kind]}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <Check className="size-3" aria-hidden />
        )}
        {compact ? null : APPROVE_LABEL[kind]}
      </Button>

      <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-full justify-center px-2 text-xs text-muted-foreground"
              disabled={pending}
              aria-label="Reject draft"
            />
          }
        >
          <X className="size-3" aria-hidden />
          {compact ? null : "Reject"}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-72 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-medium mb-2">Why reject?</p>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={[
                  "text-[11px] px-2 py-1 rounded-md border transition-colors",
                  reason === r
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-muted",
                ].join(" ")}
              >
                {REJECT_REASON_LABELS[r]}
              </button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional, sent to the agent on regenerate)…"
            rows={2}
            className="text-xs mb-2"
            aria-label="Rejection note"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => submitReject(false)}
              disabled={pending}
            >
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={() => submitReject(true)}
              disabled={pending}
            >
              <RefreshCw className="size-3" aria-hidden />
              Regenerate
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reserved: contextual menu for non-default kinds (e.g. pick a
       * different channel before approving). Mounts only when there's
       * something useful to offer. */}
      {kind === "schedule_post" && !nextAction?.targetTime && (
        <SchedulePicker postId={postId} disabled={pending} />
      )}
    </div>
  )
}

function approvedToastTitle(kind: NextActionKind): string {
  switch (kind) {
    case "schedule_post":
      return "Approved & scheduled"
    case "add_to_calendar":
      return "Approved & added to calendar"
    case "create_draft":
      return "Approved - draft opened"
    case "instantiate_template":
      return "Approved - template applied"
    case "assign_review":
      return "Approved & assigned"
    default:
      return "Approved"
  }
}

function composeFeedback(reason: RejectReason | null, note: string): string {
  const parts: string[] = []
  if (reason && reason !== "other") parts.push(REJECT_REASON_LABELS[reason])
  const trimmed = note.trim()
  if (trimmed) parts.push(trimmed)
  return parts.join(" - ")
}

/* Small dropdown that lets the approver pick "Auto-slot" vs "Pick time"
 * for posts that don't carry a targetTime in their next_action. Auto-slot
 * is the default approve path; pick-time opens the existing composer at
 * the post id. */
function SchedulePicker({
  postId,
  disabled,
}: {
  postId: string
  disabled: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 text-xs text-muted-foreground"
            disabled={disabled}
            aria-label="Schedule options"
          />
        }
      >
        ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
          When approved
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          Auto-slot via category cadence (default)
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={`/calendar?post=${postId}`} />}>
          Pick time in calendar…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
