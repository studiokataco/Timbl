"use client"

import { useSearchParams } from "next/navigation"
import { MousePointerClick } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { RunTimeline } from "./run-timeline"
import { AgentPlayground } from "./agent-playground"
import { IdeationTriage, IdeationTriageEmpty } from "./ideation-triage"

/*
 * Inspector — right rail switching by `?focus=` URL param.
 *
 * Read-only in Phase A. Phase B replaces the JSON event dump with a
 * stepped run-timeline; Phase C upgrades the agent panel to the full
 * playground (Chat / Tune / Tools / History); Phase D wires the
 * ideation triage card.
 */
type Props = {
  agents: AgentConfig[]
  runs: AgentRunDoc[]
  ideation: IdeationItem[]
}

export function Inspector({ agents, runs, ideation }: Props) {
  const params = useSearchParams()
  const focus = params.get("focus") ?? ""

  return (
    // Explicit surface + height context so the inspector renders correctly
    // whether it's the inline third column or mounted inside a Sheet portal
    // (portals don't inherit the parent's height — `h-full` would collapse
    // to 0 without this wrapper guaranteeing a flex-column scaffold).
    <div className="h-full min-h-0 flex flex-col bg-background text-foreground">
      <InspectorContent
        focus={focus}
        agents={agents}
        runs={runs}
        ideation={ideation}
      />
    </div>
  )
}

function InspectorContent({
  focus,
  agents,
  runs,
  ideation,
}: { focus: string } & Props) {
  if (focus.startsWith("agent:")) {
    const name = focus.slice(6)
    const agent = agents.find((a) => a.name === name)
    return agent ? (
      <AgentPlayground
        key={agent.id}
        agent={agent}
        allAgentNames={agents.map((a) => a.name)}
      />
    ) : (
      <NotFound label="Agent" />
    )
  }
  if (focus.startsWith("run:")) {
    const id = focus.slice(4)
    const run = runs.find((r) => r.id === id)
    return run ? <RunPanel run={run} /> : <NotFound label="Run" />
  }
  if (focus.startsWith("ideation:")) {
    const id = focus.slice(9)
    const item = ideation.find((i) => i.id === id)
    if (!item) {
      // Item may have been promoted/dismissed since hydrate; either way
      // there's nothing pending matching this id — celebrate inbox-zero
      // if the rest of the queue is empty, else show generic miss.
      return ideation.length === 0 ? (
        <IdeationTriageEmpty />
      ) : (
        <NotFound label="Idea" />
      )
    }
    return <IdeationTriage item={item} initialItems={ideation} />
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
      <MousePointerClick
        aria-hidden
        className="size-7 text-muted-foreground/50"
      />
      <p className="text-sm font-medium text-foreground">
        Nothing selected
      </p>
      <p className="text-[13px] text-muted-foreground max-w-[34ch] leading-relaxed">
        Select an agent, run, or idea to inspect its details here.
      </p>
    </div>
  )
}

/* ---------------- Run ---------------- */

function RunPanel({ run }: { run: AgentRunDoc }) {
  return <RunTimeline run={run} />
}

/* ---------------- helpers ---------------- */

function NotFound({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 gap-2">
      <p className="text-sm font-medium text-foreground">{label} not found</p>
      <p className="text-[13px] text-muted-foreground max-w-[34ch]">
        The reference in the URL no longer matches any record on this page.
      </p>
    </div>
  )
}
