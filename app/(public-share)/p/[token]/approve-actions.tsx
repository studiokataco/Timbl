"use client"

import { useState, useTransition } from "react"
import { Check, MessageSquare } from "lucide-react"
import { approveViaShareToken } from "@/lib/actions/post-shares"

interface ApproveActionsProps {
  token: string
}

type State = "idle" | "approved" | "changes_requested"

export function ApproveActions({ token }: ApproveActionsProps) {
  const [state, setState] = useState<State>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      const res = await approveViaShareToken({ token })
      if (!res.ok) { setError(res.error ?? "Could not approve"); return }
      setState("approved")
    })
  }

  function handleRequestChanges() {
    startTransition(async () => {
      const res = await approveViaShareToken({ token, requestChanges: true })
      if (!res.ok) { setError(res.error ?? "Could not submit"); return }
      setState("changes_requested")
    })
  }

  if (state === "approved") {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Check className="size-5 text-green-600 dark:text-green-400" />
        </div>
        <p className="font-medium text-foreground">Approved</p>
        <p className="text-sm text-muted-foreground">The team has been notified.</p>
      </div>
    )
  }

  if (state === "changes_requested") {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <MessageSquare className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="font-medium text-foreground">Changes requested</p>
        <p className="text-sm text-muted-foreground">The team will review your feedback.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Does this post look good to publish?</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-foreground bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50"
        >
          <Check className="size-4" />
          Approve
        </button>
        <button
          type="button"
          onClick={handleRequestChanges}
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <MessageSquare className="size-4" />
          Request changes
        </button>
      </div>
    </div>
  )
}
