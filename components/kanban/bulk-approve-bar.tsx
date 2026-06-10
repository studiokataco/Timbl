"use client"

import { useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { bulkApproveItems } from "@/lib/actions/approvals"

type Props = {
  selectedIds: string[]
  onClear: () => void
}

export function BulkApproveBar({ selectedIds, onClear }: Props) {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const count = selectedIds.length
  if (count === 0) return null

  function approveSelected() {
    startTransition(async () => {
      const res = await bulkApproveItems({
        items: selectedIds.map((id) => ({ itemType: "post" as const, itemId: id })),
      })
      queryClient.invalidateQueries({ queryKey: ["posts"] })
      queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
      if (res.ok) {
        toast.success(`Approved ${res.succeeded} ${res.succeeded === 1 ? "post" : "posts"}`)
        onClear()
      } else if (res.succeeded > 0) {
        /* Approved cards leave pending state and drop out of the selection
         * via board pruning; failed ones stay selected for a retry. */
        toast.warning(`Approved ${res.succeeded}, ${res.failed} failed`, {
          description: "Failed cards stay selected.",
        })
      } else {
        toast.error("Couldn't approve", { description: res.error })
      }
    })
  }

  return (
    <div
      role="toolbar"
      aria-label="Bulk approval"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 shadow-md"
    >
      <span className="text-sm tabular-nums">{count} selected</span>
      <Button size="sm" onClick={approveSelected} disabled={pending}>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-3.5" aria-hidden />
        )}
        Approve selected
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        onClick={onClear}
        disabled={pending}
      >
        <X className="size-3.5" aria-hidden />
        Clear
      </Button>
    </div>
  )
}
