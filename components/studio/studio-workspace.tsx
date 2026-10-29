"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Plus, Sparkles, X } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import type { ApprovalLogRow } from "@/lib/actions/approvals"
import type { StudioUsage } from "@/lib/actions/usage"
import { isBoutiqueAgent } from "@/lib/agents/defaults"
import { usePlanFeatures } from "@/lib/plans/client"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyRosterCta } from "./empty-roster-cta"
import { IdeationTriage, IdeationTriageEmpty } from "./ideation-triage"
import { RunTimeline } from "./run-timeline"
import { agentLabel } from "./agent-meta"
import { ActivityList } from "./activity-list"
import { AddAgentPanel } from "./add-agent-panel"
import { AgentDetail } from "./agent-detail"
import { AgentList } from "./agent-list"
import { NeedsYou } from "./needs-you"
import { StatsStrip } from "./charts"
import { useRemembered } from "@/components/ui/disclosure"
import {
  useStudioApprovals,
  useStudioHistory,
  useStudioIdeation,
  useStudioRuns,
  useStudioUsage,
  useStudioView,
  useToggleAgent,
} from "./use-studio-data"

type Props = {
  agents: AgentConfig[]
  runs: AgentRunDoc[]
  ideation: IdeationItem[]
  approvals: ApprovalLogRow[]
  usage: StudioUsage
  history: AgentRunDoc[]
}

export function StudioWorkspace(props: Props) {
  const runs = useStudioRuns(props.runs)
  const history = useStudioHistory(props.history, runs)
  const ideation = useStudioIdeation(props.ideation)
  const approvals = useStudioApprovals(props.approvals)
  const usage = useStudioUsage(props.usage)
  const { view, dir, update, dismiss } = useStudioView()
  const { agents, toggle, pending } = useToggleAgent(props.agents)
  const planFeatures = usePlanFeatures()
  const isFree = planFeatures.quotas.agents === 0
  const [addOpen, setAddOpen] = useState(false)
  const [trendOpen, setTrendOpen] = useRemembered("trend", false)
  const reduced = useReducedMotion()
  const scrollRef = useRef<HTMLDivElement>(null)

  const boutique = useMemo(() => agents.filter((a) => isBoutiqueAgent(a.name)), [agents])
  const active = boutique.filter((a) => a.enabled)
  const off = boutique.filter((a) => !a.enabled)
  const agentCap =
    planFeatures.quotas.agents == null ? boutique.length : Math.min(planFeatures.quotas.agents, boutique.length)
  const selected = view.agent ? agents.find((a) => a.name === view.agent) ?? null : null
  const waiting = runs.filter((r) => r.status === "awaiting_human")
  const runningCount = runs.filter((r) => r.status === "in_progress").length
  const openRun = view.run ? history.runs.find((r) => r.id === view.run) ?? null : null
  const openIdea = view.idea ? ideation.find((i) => i.id === view.idea) ?? null : null

  const homeScroll = useRef<number | null>(null)
  const lastAgent = useRef<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (view.agent) lastAgent.current = view.agent
  }, [view.agent])

  function openAgent(name: string) {
    if (!view.agent) homeScroll.current = scrollRef.current?.scrollTop ?? 0
    update({ agent: name, tab: null })
  }

  function settleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (view.agent) {
      el.scrollTo({ top: 0 })
      return
    }
    const from = lastAgent.current
    requestAnimationFrame(() => {
      if (homeScroll.current != null) el.scrollTo({ top: homeScroll.current })
      homeScroll.current = null
      const row = from ? el.querySelector(`[data-agent-row="${from}"]`) : null
      if (!row) return
      const box = el.getBoundingClientRect()
      const r = row.getBoundingClientRect()
      if (r.top < box.top || r.bottom > box.bottom - 96) {
        row.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" })
      }
    })
    if (from) {
      setFlash(from)
      window.setTimeout(() => setFlash(null), 1600)
    }
  }

  const summary = [
    `${active.length} ${active.length === 1 ? "agent" : "agents"} on`,
    runningCount > 0 && `${runningCount} running now`,
    waiting.length > 0 && `${waiting.length} waiting on you`,
  ]
    .filter(Boolean)
    .join(" · ")

  const addButton = isFree ? (
    <Button variant="outline" size="sm" render={<a href="/settings/billing" />} nativeButton={false}>
      <Sparkles className="size-3.5" aria-hidden />
      Upgrade for agents
    </Button>
  ) : (
    <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
      <Plus className="size-3.5" aria-hidden />
      Add agent
    </Button>
  )

  const slide = {
    enter: (d: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: d * 28 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const } },
    exit: (d: number) =>
      reduced ? { opacity: 0 } : { opacity: 0, x: d * -20, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const } },
  }
  const motionProps = { custom: dir, variants: slide, initial: "enter", animate: "center", exit: "exit" }

  return (
    <div
      ref={scrollRef}
      className="-mb-[var(--ask-ai-clearance)] min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[var(--ask-ai-clearance)]"
    >
      <AnimatePresence mode="wait" initial={false} custom={dir} onExitComplete={settleScroll}>
        {selected ? (
          <motion.div
            key={`agent:${selected.name}`}
            {...motionProps}
            className="mx-auto w-full max-w-6xl"
          >
            <AgentDetail
              agent={selected}
              runs={history.runs}
              usage={usage}
              tab={view.tab}
              togglePending={pending === selected.name}
              onTab={(tab) => update({ tab: tab === "overview" ? null : tab }, "replace")}
              onBack={() => dismiss({ agent: null, tab: null })}
              onToggle={(v) => toggle(selected.name, v)}
              onOpenRun={(id) => update({ run: id })}
              allAgentNames={active.map((a) => a.name)}
              onSwitchAgent={(name) => update({ agent: name, tab: "chat" }, "replace")}
              agents={boutique}
              onNavigate={(name, d) => update({ agent: name }, "replace", d)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="home"
            {...motionProps}
            className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 md:pt-8 lg:px-10"
          >
            <PageHeader size="sm" title="AI Studio" description={summary} action={<span className="hidden sm:block">{addButton}</span>} />

            {boutique.length === 0 ? (
              <div className="mt-8">
                <EmptyRosterCta onAdd={() => setAddOpen(true)} />
              </div>
            ) : (
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:grid-rows-[auto_auto_1fr] xl:gap-x-10 xl:gap-y-8">
                <div className="min-w-0 xl:col-start-1 xl:row-start-2">
                  <NeedsYou
                    approvals={waiting}
                    ideas={ideation}
                    onOpenRun={(id) => update({ run: id })}
                    onOpenIdea={(id) => update({ idea: id })}
                  />
                </div>
                <div className="min-w-0 xl:col-span-2 xl:row-start-1">
                  <StatsStrip
                    runs={history.runs}
                    complete={history.complete}
                    runsUsed={usage.agentRuns}
                    runsQuota={planFeatures.quotas.agentRuns}
                    activeCount={active.length}
                    agentCap={agentCap}
                    trendOpen={trendOpen}
                    onTrend={setTrendOpen}
                  />
                </div>
                <div className="min-w-0 xl:col-start-1 xl:row-start-3">
                  <AgentList
                    active={active}
                    off={off}
                    runs={history.runs}
                    pending={pending}
                    onOpen={openAgent}
                    highlight={flash}
                    onToggle={toggle}
                    action={<span className="sm:hidden">{addButton}</span>}
                  />
                </div>
                <div className="min-w-0 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-2 xl:self-start">
                  <ActivityList
                    runs={runs}
                    approvals={approvals}
                    onOpenRun={(id) => update({ run: id })}
                    limit={6}
                    compact
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!view.run} onOpenChange={(o) => !o && dismiss({ run: null })}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col gap-0 overflow-hidden bg-background p-0 text-foreground sm:max-w-lg"
        >
          <SheetPanelHeader
            title={openRun ? `${agentLabel(openRun.agentName)} run` : "Run"}
            onClose={() => dismiss({ run: null })}
          />
          <div className="min-h-0 flex-1">
            {openRun ? (
              <RunTimeline run={openRun} />
            ) : (
              <p className="p-5 text-[13px] text-muted-foreground">This run is no longer in the recent list.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!view.idea} onOpenChange={(o) => !o && dismiss({ idea: null })}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col gap-0 overflow-hidden bg-background p-0 text-foreground sm:max-w-lg"
        >
          <SheetPanelHeader
            title={ideation.length > 0 ? `Ideas · ${ideation.length} to review` : "Ideas"}
            onClose={() => dismiss({ idea: null })}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {openIdea ? (
              <IdeationTriage
                item={openIdea}
                initialItems={ideation}
                onNavigate={(id) => (id ? update({ idea: id }, "replace") : dismiss({ idea: null }))}
              />
            ) : (
              <IdeationTriageEmpty />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddAgentPanel
        open={addOpen}
        onOpenChange={setAddOpen}
        agents={agents}
        pending={pending}
        onToggle={toggle}
        onOpenAgent={openAgent}
      />
    </div>
  )
}

function SheetPanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border px-5 py-3.5">
      <SheetTitle className="text-[15px] font-semibold">{title}</SheetTitle>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden />
      </button>
    </SheetHeader>
  )
}
