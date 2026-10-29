"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Loader2, MessageSquare, Play, Power } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { StudioUsage } from "@/lib/actions/usage"
import { compact } from "@/lib/platform/format"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { AgentChat } from "@/components/agents/agent-chat"
import { cn } from "@/lib/utils"
import { getTool } from "./tool-catalog"
import {
  HEADLESS_AGENTS,
  STATE_COPY,
  agentLabel,
  agentState,
  agentTagline,
  runTokens,
  scheduleLabel,
} from "./agent-meta"
import { AgentGlyph, StatusDot, ago } from "./bits"
import { ActivityList } from "./activity-list"
import { AgentNav } from "./agent-nav"
import { HealthCard } from "./charts"
import { AgentSettings } from "./agent-settings"
import { NeedsYou } from "./needs-you"
import { useRunNow } from "./use-studio-data"

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "chat", label: "Chat" },
  { key: "runs", label: "Runs" },
  { key: "settings", label: "Settings" },
] as const

type TabKey = (typeof TABS)[number]["key"]

type Props = {
  agent: AgentConfig
  runs: AgentRunDoc[]
  usage: StudioUsage
  tab: string | null
  togglePending: boolean
  onTab: (tab: TabKey) => void
  onBack: () => void
  onToggle: (enabled: boolean) => void
  onOpenRun: (id: string) => void
  allAgentNames: string[]
  onSwitchAgent: (name: string) => void
  agents: AgentConfig[]
  onNavigate: (name: string, dir: 1 | -1) => void
}

export function AgentDetail({
  agent,
  runs,
  usage,
  tab: rawTab,
  togglePending,
  onTab,
  onBack,
  onToggle,
  onOpenRun,
  allAgentNames,
  onSwitchAgent,
  agents,
  onNavigate,
}: Props) {
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "overview"
  const reduced = useReducedMotion()
  const own = useMemo(() => runs.filter((r) => r.agentName === agent.name), [runs, agent.name])
  const state = agentState(agent, runs)
  const copy = STATE_COPY[state]
  const last = own[0]
  const label = agentLabel(agent.name)
  const canRunNow = HEADLESS_AGENTS.has(agent.name) && agent.enabled && agent.triggers.manual
  const { run, running } = useRunNow(agent.name)
  const headerRef = useRef<HTMLElement>(null)
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    let root: HTMLElement | null = el.parentElement
    while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) root = root.parentElement
    const io = new IntersectionObserver(([entry]) => setCondensed(!entry.isIntersecting), {
      root,
      rootMargin: "-56px 0px 0px 0px",
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const primary = (size: "sm" | "default") =>
    !agent.enabled ? (
      <Button size={size} onClick={() => onToggle(true)} disabled={togglePending} className={size === "default" ? "h-9 flex-1 md:flex-none" : undefined}>
        {togglePending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Power className="size-4" aria-hidden />}
        Turn on
      </Button>
    ) : canRunNow ? (
      <Button size={size} onClick={run} disabled={running} className={size === "default" ? "h-9 flex-1 md:flex-none" : undefined}>
        {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {running ? "Running" : "Run now"}
      </Button>
    ) : tab !== "chat" ? (
      <Button size={size} onClick={() => onTab("chat")} className={size === "default" ? "h-9 flex-1 md:flex-none" : undefined}>
        <MessageSquare className="size-4" aria-hidden />
        Chat
      </Button>
    ) : null

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-30 px-4 sm:px-6 lg:px-10">
        <AgentNav
          agent={agent}
          agents={agents}
          runs={runs}
          condensed={condensed}
          action={primary("sm")}
          onBack={onBack}
          onSwitch={onNavigate}
        />
      </div>
      <div className="px-4 pt-2 sm:px-6 lg:px-10">
        <header ref={headerRef} className="mt-2 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <AgentGlyph name={agent.name} size="lg" muted={!agent.enabled} />
            <div className="min-w-0">
              <h1 className="text-title-lg text-foreground text-balance">{label}</h1>
              <p className="mt-0.5 max-w-[60ch] text-[14px] text-muted-foreground text-pretty">
                {agentTagline(agent)}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                <span className={cn("inline-flex items-center gap-1.5 font-medium", state === "active" ? "text-foreground" : copy.text)}>
                  <StatusDot className={copy.dot} pulse={state === "running"} />
                  {copy.label}
                </span>
                {agent.enabled && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{scheduleLabel(agent)}</span>
                  </>
                )}
                {last && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Ran {ago(last.startedAt)}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label className="flex h-9 items-center gap-2.5 rounded-lg border border-border px-3 text-[13px] font-medium text-foreground">
              <Switch
                checked={agent.enabled}
                disabled={togglePending}
                onCheckedChange={onToggle}
                aria-label={agent.enabled ? `Turn off ${label}` : `Turn on ${label}`}
              />
              {agent.enabled ? "On" : "Off"}
            </label>
            {primary("default")}
          </div>
        </header>
      </div>

      <div className="sticky top-14 z-20 bg-background/95 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:px-6 lg:px-10">
        <nav
          role="tablist"
          aria-label={`${label} sections`}
          className="no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
        >
          {TABS.map((t) => {
            const active = t.key === tab
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTab(t.key)}
                className={cn(
                  "relative shrink-0 px-3 pb-3 pt-1 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.key === "runs" && own.length > 0 && (
                  <span className="ml-1.5 text-[12px] tabular-nums text-muted-foreground">
                    <span className="sr-only">, </span>
                    {own.length}
                  </span>
                )}
                {active &&
                  (reduced ? (
                    <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />
                  ) : (
                    <motion.span
                      layoutId="agent-tab-indicator"
                      aria-hidden
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground"
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ))}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {tab === "overview" && (
          <Overview agent={agent} runs={own} usage={usage} onOpenRun={onOpenRun} onChat={() => onTab("chat")} />
        )}
        {tab === "chat" && (
          <div className="space-y-3">
            {!agent.enabled && (
              <OffNotice onTurnOn={() => onToggle(true)} pending={togglePending} />
            )}
            <div className="h-[calc(100dvh-22rem)] min-h-[440px] overflow-hidden rounded-xl border border-border">
              <AgentChat
                agentName={agent.name}
                intro="Messages run for real: drafts are created and credits are used."
                agentCatalog={allAgentNames}
                onAgentSwitch={onSwitchAgent}
                className="h-full"
              />
            </div>
          </div>
        )}
        {tab === "runs" && <RunsTab runs={own} onOpenRun={onOpenRun} />}
        {tab === "settings" && <AgentSettings key={agent.updatedAt ?? agent.name} agent={agent} />}
      </div>
    </div>
  )
}

function Overview({
  agent,
  runs,
  usage,
  onOpenRun,
  onChat,
}: {
  agent: AgentConfig
  runs: AgentRunDoc[]
  usage: StudioUsage
  onOpenRun: (id: string) => void
  onChat: () => void
}) {
  const month = usage.byAgent.find((u) => u.agent === agent.name)
  const waiting = runs.filter((r) => r.status === "awaiting_human")
  const tools = agent.allowedTools.map((k) => getTool(k).title)

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-12">
      <div className="min-w-0 space-y-8">
        {runs.length > 0 && <HealthCard runs={runs} />}
        {waiting.length > 0 && (
          <NeedsYou approvals={waiting} ideas={[]} onOpenRun={onOpenRun} onOpenIdea={() => {}} />
        )}
        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-[14px] font-medium text-foreground">No runs yet</p>
            <p className="mx-auto mt-1 max-w-[40ch] text-[13px] text-muted-foreground">
              {agent.enabled
                ? `${scheduleLabel(agent) === "On demand" ? "This agent runs when you ask." : `Next run follows its schedule: ${scheduleLabel(agent).toLowerCase()}.`} You can also start it from chat.`
                : "Turn this agent on to let it work."}
            </p>
            {agent.enabled && (
              <Button variant="outline" size="sm" className="mt-4" onClick={onChat}>
                <MessageSquare className="size-3.5" aria-hidden />
                Open chat
              </Button>
            )}
          </div>
        ) : (
          <ActivityList runs={runs} onOpenRun={onOpenRun} title="Recent runs" limit={6} filterable={false} sectionId="agent-recent" hideAgent />
        )}
      </div>

      <aside aria-label="Details" className="xl:border-l xl:border-border xl:pl-8">
        <dl className="divide-y divide-border text-[13px]">
          <Fact term="Schedule">{agent.triggers.cron ? scheduleLabel(agent) : "On demand"}</Fact>
          <Fact term="Runs this month">
            {month ? (
              <>
                {compact(month.calls)}
                <span className="text-muted-foreground"> · {compact(month.tokens)} tokens</span>
              </>
            ) : (
              "None yet"
            )}
          </Fact>
          <Fact term="Spend cap">${agent.budgets.monthlyUsdCap} a month</Fact>
          <Fact term="Model">
            <span className="break-all font-mono text-[12px]">{agent.model}</span>
          </Fact>
          <Fact term="Tools">
            {tools.length === 0 ? (
              "Text only"
            ) : (
              <span className="flex flex-wrap justify-end gap-1">
                {tools.map((t) => (
                  <span key={t} className="rounded-md bg-secondary px-1.5 py-0.5 text-[12px] text-foreground">
                    {t}
                  </span>
                ))}
              </span>
            )}
          </Fact>
        </dl>
      </aside>
    </div>
  )
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 first:pt-0">
      <dt className="shrink-0 text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{children}</dd>
    </div>
  )
}

function RunsTab({ runs, onOpenRun }: { runs: AgentRunDoc[]; onOpenRun: (id: string) => void }) {
  const stats = useMemo(() => {
    const done = runs.filter((r) => r.status === "succeeded" || r.status === "failed")
    const ok = runs.filter((r) => r.status === "succeeded").length
    const durations = runs.map((r) => r.durationMs).filter((d): d is number => typeof d === "number" && d > 0)
    return {
      total: runs.length,
      success: done.length ? `${Math.round((ok / done.length) * 100)}%` : "-",
      avg: durations.length ? `${(durations.reduce((a, b) => a + b, 0) / durations.length / 1000).toFixed(1)}s` : "-",
      tokens: compact(runs.reduce((s, r) => s + runTokens(r), 0)),
    }
  }, [runs])

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Stat label="Runs" value={String(stats.total)} />
        <Stat label="Success rate" value={stats.success} />
        <Stat label="Avg duration" value={stats.avg} />
        <Stat label="Tokens" value={stats.tokens} />
      </dl>
      <ActivityList runs={runs} onOpenRun={onOpenRun} title="All runs" limit={20} sectionId="agent-all" hideAgent />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[18px] font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function OffNotice({ onTurnOn, pending }: { onTurnOn: () => void; pending: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
      <Power className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="flex-1 text-[13px] text-foreground">This agent is off. Turn it on to chat with it.</p>
      <Button size="sm" variant="outline" onClick={onTurnOn} disabled={pending}>
        Turn on
      </Button>
    </div>
  )
}
