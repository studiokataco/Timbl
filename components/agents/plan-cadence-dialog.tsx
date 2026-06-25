"use client"

import { useRef, useState } from "react"
import { addDays, format } from "date-fns"
import { Sparkles } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { AgentAskShell } from "./agent-ask-shell"
import { AgentChat, type AgentChatHandle } from "./agent-chat"

/*
 * Wraps the cadence-planner agent. The default brief covers the next 14
 * days starting from the calendar's currently-visible date - the user can
 * rewrite freely before sending.
 */

const CADENCE_AGENTS = ["cadence-planner"]

export function PlanCadenceDialog({
  open,
  onOpenChange,
  startDate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  startDate: Date
}) {
  const start = format(startDate, "yyyy-MM-dd")
  const end = format(addDays(startDate, 13), "yyyy-MM-dd")
  const [closed, setClosed] = useState(0)
  const [input, setInput] = useState(`Plan a posting cadence from ${start} to ${end}.`)
  const [streaming, setStreaming] = useState(false)
  const [transcriptLength, setTranscriptLength] = useState(0)
  const chatRef = useRef<AgentChatHandle | null>(null)

  const submit = (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || streaming) return
    chatRef.current?.submit(text)
    if (override === undefined) setInput("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-2xl !w-[92vw] !h-[80vh] !max-h-[80vh] !p-0 !gap-0 flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-5 py-4 border-b border-border space-y-1 text-left">
          <DialogTitle className="text-title-sm flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden /> Plan cadence
          </DialogTitle>
          <DialogDescription className="text-caption">
            Drafts a posting schedule across your preferred days and times, then
            adds the posts to your calendar for approval.
          </DialogDescription>
        </DialogHeader>

        <AgentAskShell
          chatRef={chatRef}
          resolvedActiveAgent="cadence-planner"
          pickerAgentNames={CADENCE_AGENTS}
          onAgentSwitch={() => {}}
          input={input}
          onInputChange={setInput}
          streaming={streaming}
          onSubmit={submit}
          isEmpty={transcriptLength === 0}
          showEmptyState={false}
          showAgentPicker={false}
          showShortcutHints={false}
          placeholder="e.g. 3 posts a week - Mon/Wed/Fri mornings - through July"
          className="flex-1 min-h-0"
        >
          <AgentChat
            ref={chatRef}
            key={closed}
            agentName="cadence-planner"
            intro={`Plan a posting cadence from ${start} to ${end}. I'll read your brand cadence and write drafts you can approve from the kanban.`}
            compact
            onStreamingChange={setStreaming}
            onMessage={() =>
              setTranscriptLength(chatRef.current?.getTranscript().length ?? 0)
            }
            onFinish={() => setClosed((v) => v + 1)}
            className="h-full"
          />
        </AgentAskShell>
      </DialogContent>
    </Dialog>
  )
}
