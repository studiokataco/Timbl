"use client"

import { useState } from "react"
import { addDays, format } from "date-fns"
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
 * Wraps the cadence-planner agent. The default brief covers the next 14
 * days starting from the calendar's currently-visible date — the user can
 * rewrite freely before sending.
 */

export function PlanCadenceDialog({
  open,
  onOpenChange,
  startDate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  startDate: Date
}) {
  const [closed, setClosed] = useState(0)
  const start = format(startDate, "yyyy-MM-dd")
  const end = format(addDays(startDate, 13), "yyyy-MM-dd")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-2xl !h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden /> Plan cadence
          </DialogTitle>
          <DialogDescription className="text-xs">
            The cadence-planner reads your brand&apos;s preferred days and times,
            avoids conflicts, and writes pending drafts to your calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0" key={closed}>
          <AgentChat
            agentName="cadence-planner"
            intro={`Plan a posting cadence from ${start} to ${end}. I'll read your brand cadence and write drafts you can approve from the kanban.`}
            placeholder={`Plan from ${start} to ${end}…`}
            onFinish={() => setClosed((v) => v + 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
