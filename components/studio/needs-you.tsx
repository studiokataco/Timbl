"use client"

import { useId, useState } from "react"
import { ArrowRight, Check, CheckCircle2, Loader2, X } from "lucide-react"

import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DisclosureBody, DisclosureChevron } from "@/components/ui/disclosure"
import { useApprovalGate } from "./use-approval-gate"
import { agentLabel } from "./agent-meta"
import { AgentGlyph, ago } from "./bits"
import { Section } from "./section"

type Props = {
  approvals: AgentRunDoc[]
  ideas: IdeationItem[]
  onOpenRun: (id: string) => void
  onOpenIdea: (id: string) => void
}

export function NeedsYou({ approvals, ideas, onOpenRun, onOpenIdea }: Props) {
  if (approvals.length === 0 && ideas.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border px-4 py-3">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <p className="text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">You&rsquo;re all caught up.</span> Agents ask before anything gets published.
        </p>
      </div>
    )
  }

  const summary = [
    approvals.length > 0 && `${approvals.length} ${approvals.length === 1 ? "approval" : "approvals"}`,
    ideas.length > 0 && `${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"}`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Section id="needs" title="Needs you" count={approvals.length + ideas.length} summary={summary}>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {approvals.map((run) => (
          <li key={run.id}>
            <ApprovalRow run={run} onOpenRun={() => onOpenRun(run.id)} />
          </li>
        ))}
        {ideas.length > 0 && (
          <li>
            <button
              type="button"
              onClick={() => onOpenIdea(ideas[0].id)}
              className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
            >
              <AgentGlyph name="ideator" size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px]">
                <span className="font-medium text-foreground">
                  {ideas.length} new {ideas.length === 1 ? "idea" : "ideas"}
                </span>
                <span className="text-muted-foreground"> · {ideas[0].title}</span>
              </span>
              <span className="hidden text-[13px] font-medium text-foreground sm:inline">Review</span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
          </li>
        )}
      </ul>
    </Section>
  )
}

function ApprovalRow({ run, onOpenRun }: { run: AgentRunDoc; onOpenRun: () => void }) {
  const { gate, act, pending } = useApprovalGate(run)
  const bodyId = useId()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const body = gate?.summary ?? run.inputSummary ?? "Waiting for your decision."
  const label = agentLabel(run.agentName)
  const done = () => {
    setOpen(false)
    setNote("")
  }

  return (
    <div className="bg-orange-50/60 dark:bg-orange-950/20">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AgentGlyph name={run.agentName} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px]">
              <span className="font-medium text-foreground">{label}</span>
              <span className="truncate text-muted-foreground">
                <span className="hidden sm:inline">wants approval · </span>
                {ago(run.startedAt)}
              </span>
            </span>
            <span className="block truncate text-[13px] text-foreground/80">{body}</span>
          </span>
          <DisclosureChevron open={open} className="hidden sm:block" />
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => act("approve", note.trim() || undefined, done)}
            aria-label={`Approve ${label}`}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            <span className="hidden sm:inline">Approve</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            className="bg-background"
            onClick={() => act("reject", note.trim() || undefined, done)}
            aria-label={`Reject ${label}`}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      <DisclosureBody id={bodyId} open={open} className="space-y-3 px-3 pb-3 sm:pl-[3.75rem] sm:pr-4">
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">{body}</p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note for the agent, sent with your decision"
          rows={2}
          aria-label="Note for the agent"
          className="bg-background text-[13px]"
        />
        <button
          type="button"
          onClick={onOpenRun}
          className="rounded text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          See the full run
        </button>
      </DisclosureBody>
    </div>
  )
}
