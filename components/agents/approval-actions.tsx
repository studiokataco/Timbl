"use client"

import { useTransition } from "react"
import { Check, Loader2, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  approveAgentDraft,
  rejectAgentDraft,
} from "@/lib/actions/agent-suggestions"

/*
 * Inline Approve / Reject controls rendered on any kanban card whose
 * agentMeta.reviewState === 'pending'. Calling either action resolves
 * the LongRunningFunctionTool the run is paused on — the run continues
 * and the scheduler stage runs to completion.
 *
 * We intentionally do not auto-stream the run continuation here; the
 * /settings/runs page is the right place to watch progress.
 */

export function ApprovalActions({
  postId,
  className,
}: {
  postId: string
  className?: string
}) {
  const [pending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  function act(action: "approve" | "reject") {
    startTransition(async () => {
      const fn = action === "approve" ? approveAgentDraft : rejectAgentDraft
      const res = await fn({ postId })
      if (res.ok) {
        toast.success(action === "approve" ? "Approved" : "Rejected")
        queryClient.invalidateQueries({ queryKey: ["posts"] })
        if (res.resumeRunId && res.resumeToolCallId) {
          // Fire-and-forget the resume so the pipeline finishes.
          fetch(`/api/agents/runs/${res.resumeRunId}/resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toolCallId: res.resumeToolCallId,
              approved: action === "approve",
            }),
          }).catch(() => {
            /* surfaced in /settings/runs if it fails */
          })
        }
      } else {
        toast.error("Failed", { description: res.error })
      }
    })
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={() => act("approve")}
        disabled={pending}
        aria-label="Approve draft"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <Check className="size-3" aria-hidden />
        )}
        Approve
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={() => act("reject")}
        disabled={pending}
        aria-label="Reject draft"
      >
        <X className="size-3" aria-hidden />
        Reject
      </Button>
    </div>
  )
}
