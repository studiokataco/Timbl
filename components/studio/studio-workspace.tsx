"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Sparkles, X } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import type { ApprovalLogRow } from "@/lib/actions/approvals"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PageHeader } from "@/components/shared/page-header"
import { useMediaQuery } from "@/lib/hooks/use-media-query"
import { usePlanFeatures } from "@/lib/plans/client"
import { AGENT_TEMPLATES } from "@/lib/agents/template-catalog"
import { cn } from "@/lib/utils"

import { Roster } from "./roster"
import { PipelineGraph } from "./pipeline-graph"
import { ActivityStream } from "./activity-stream"
import { Inspector } from "./inspector"
import { EmptyRosterCta } from "./empty-roster-cta"
import { AddAgentSheet } from "./add-agent-sheet"
import { agentsForStudioRoster } from "@/lib/onboarding/agent-catalog"

const AGENT_LABELS: Record<string, string> = Object.fromEntries(
  AGENT_TEMPLATES.map((t) => [t.name, t.label ?? t.name]),
)

type Props = {
  agents: AgentConfig[]
  runs: AgentRunDoc[]
  ideation: IdeationItem[]
  approvals?: ApprovalLogRow[]
  publishCounts?: { scheduled: number; posted: number }
}

export function StudioWorkspace({
  agents,
  runs,
  ideation,
  approvals = [],
  publishCounts,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const focus = params.get("focus") ?? ""
  const hasFocus = focus.length > 0
  const isWide = useMediaQuery("(min-width: 1280px)")
  const showSheet = hasFocus && !isWide
  const rosterAgents = useMemo(() => agentsForStudioRoster(agents), [agents])

  function closeFocus() {
    const next = new URLSearchParams(params.toString())
    next.delete("focus")
    const qs = next.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_380px] divide-x divide-border">
      <aside className="hidden md:block min-h-0 overflow-hidden">
        <Roster rosterAgents={rosterAgents} installedAgents={agents} />
      </aside>

      <main className="min-h-0 min-w-0 overflow-y-auto flex flex-col pb-24 md:pb-0">
        <div className="px-4 sm:px-6 pt-6 md:pt-8 pb-4 md:pb-2 border-b border-border md:border-b-0">
          <PageHeader
            size="sm"
            title="AI Studio"
            description="Control AI agents work from idea to schedule. Agents can be enabled/disabled, and their settings can be edited."
          />
          <div className="md:hidden mt-6">
            <MobileAgentPicker agents={rosterAgents} installedAgents={agents} />
          </div>
        </div>

        {rosterAgents.length === 0 ? (
          <EmptyRosterCta agents={agents} />
        ) : (
          <>
            <PipelineGraph
              agents={rosterAgents}
              runs={runs}
              initialPublishCounts={publishCounts}
            />
            <ActivityStream
              initialRuns={runs}
              initialIdeation={ideation}
              initialApprovals={approvals}
            />
          </>
        )}
      </main>

      <aside className="hidden xl:block min-h-0 overflow-hidden bg-background">
        <Inspector agents={rosterAgents} runs={runs} ideation={ideation} />
      </aside>

      {!isWide && (
        <Sheet
          open={showSheet}
          onOpenChange={(open) => {
            if (!open) closeFocus()
          }}
        >
          <SheetContent
            side="right"
            className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col bg-background text-foreground"
            showCloseButton={false}
          >
            <SheetHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between gap-2 space-y-0">
              <SheetTitle className="text-title-sm">Inspector</SheetTitle>
              <button
                type="button"
                onClick={closeFocus}
                aria-label="Close inspector"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                <X className="size-4" aria-hidden />
              </button>
            </SheetHeader>
            <div className="flex-1 min-h-0">
              <Inspector agents={rosterAgents} runs={runs} ideation={ideation} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function MobileAgentPicker({
  agents,
  installedAgents,
}: {
  agents: AgentConfig[]
  installedAgents: AgentConfig[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const planFeatures = usePlanFeatures()
  const focus = params.get("focus") ?? ""
  const selected = focus.startsWith("agent:") ? focus.slice(6) : null
  const [addOpen, setAddOpen] = useState(false)
  const isFree = planFeatures.quotas.agents === 0

  function select(name: string) {
    const next = new URLSearchParams(params.toString())
    if (selected === name) next.delete("focus")
    else next.set("focus", `agent:${name}`)
    const qs = next.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  return (
    <>
      <nav aria-label="Agents" className="py-0">
        <div className="grid grid-cols-2 gap-2">
          {agents.map((a) => {
            const active = selected === a.name
            const label = AGENT_LABELS[a.name] ?? a.name
            return (
              <button
                key={a.name}
                type="button"
                onClick={() => select(a.name)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-foreground/25 bg-secondary"
                    : "border-border bg-background hover:bg-secondary/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    a.enabled ? "bg-emerald-500" : "bg-border",
                  )}
                />
                <span className="min-w-0 text-[13px] font-medium leading-tight text-foreground line-clamp-2">
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {isFree ? (
          <a
            href="/settings/billing"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Upgrade to add agents
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden />
            Add agent
          </button>
        )}
      </nav>
      <AddAgentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        installedAgents={installedAgents}
      />
    </>
  )
}
