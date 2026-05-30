"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { AgentChat } from "./agent-chat"

/*
 * Wraps an AgentChat that drives the full workflow pipeline. Opens from the
 * kanban column's overflow menu. The default brief seeds the run with the
 * column context - the user can edit before sending.
 *
 * We chose the pipeline (rather than drafter alone) so the same run also
 * goes through review + scheduler. The human-gate inside the pipeline
 * pauses on each draft; the user reviews via the kanban card's inline
 * Approve / Reject controls.
 */

export function GenerateDraftsDialog({
  open,
  onOpenChange,
  columnId,
  columnLabel,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  columnId: string
  columnLabel: string
}) {
  // Reserve column meta for future wiring (currently only used to seed copy).
  void columnId
  const [closed, setClosed] = useState(0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl !h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden /> Generate drafts · {columnLabel}
          </DialogTitle>
          <DialogDescription className="text-xs">
            The pipeline drafts, reviews, then pauses on each draft for your approval.
            Approve directly from the kanban card.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0" key={closed}>
          <AgentChat
            agentName="pipeline"
            intro={`Tell me what kinds of posts you want for "${columnLabel}". I'll draft, review, and queue each one for your approval.`}
            placeholder={`Briefing for "${columnLabel}"…`}
            onFinish={() => setClosed((v) => v + 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
