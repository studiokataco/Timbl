"use client"

import { useId, useMemo } from "react"
import { ChevronRight, Clock } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import { Switch } from "@/components/ui/switch"
import { DisclosureBody, DisclosureTrigger, useRemembered } from "@/components/ui/disclosure"
import { cn } from "@/lib/utils"
import {
  RUN_STATUS_COPY,
  STATE_COPY,
  agentLabel,
  agentState,
  agentTagline,
  groupAgents,
  scheduleLabel,
} from "./agent-meta"
import { AgentGlyph, StatusDot, ago } from "./bits"
import { Section } from "./section"
import { HealthStrip } from "./charts"

type Props = {
  active: AgentConfig[]
  off: AgentConfig[]
  runs: AgentRunDoc[]
  pending: string | null
  onOpen: (name: string) => void
  onToggle: (name: string, enabled: boolean) => void
  action?: React.ReactNode
  highlight?: string | null
}

export function AgentList({ active, off, runs, pending, onOpen, onToggle, action, highlight }: Props) {
  const [showOff, setShowOff] = useRemembered("studio.agents-off", false)
  const offId = useId()
  const groups = groupAgents(active)

  return (
    <Section
      id="agents"
      title="Agents"
      count={active.length}
      summary={agentSummary(active, runs)}
      action={action}
    >

      <div className="overflow-hidden rounded-xl border border-border">
        {groups.map((g, gi) => (
          <div key={g.key} className={cn(gi > 0 && "border-t border-border")}>
            <p className="bg-secondary/40 px-4 py-1.5 text-[12px] font-medium text-muted-foreground">
              {g.label}
            </p>
            <ul className="divide-y divide-border">
              {g.agents.map((a) => (
                <li key={a.name}>
                  <AgentRow
                    agent={a}
                    runs={runs}
                    pending={pending === a.name}
                    highlight={highlight === a.name}
                    onOpen={() => onOpen(a.name)}
                    onToggle={(v) => onToggle(a.name, v)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {off.length > 0 && (
          <div className={cn(groups.length > 0 && "border-t border-border")}>
            <DisclosureTrigger
              open={showOff}
              onOpenChange={setShowOff}
              controls={offId}
              chevronClassName="size-3.5 text-current group-hover:text-current"
              className="px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            >
              {`${off.length} ${off.length === 1 ? "agent" : "agents"} turned off`}
            </DisclosureTrigger>
            <DisclosureBody id={offId} open={showOff}>
              <ul className="divide-y divide-border border-t border-border">
                {off.map((a) => (
                  <li key={a.name}>
                    <AgentRow
                      agent={a}
                      runs={runs}
                      pending={pending === a.name}
                      onOpen={() => onOpen(a.name)}
                      onToggle={(v) => onToggle(a.name, v)}
                    />
                  </li>
                ))}
              </ul>
            </DisclosureBody>
          </div>
        )}
      </div>
    </Section>
  )
}

function agentSummary(active: AgentConfig[], runs: AgentRunDoc[]): string {
  const states = active.map((a) => agentState(a, runs))
  const running = states.filter((s) => s === "running").length
  const failing = states.filter((s) => s === "failed").length
  return [
    `${active.length} on`,
    running > 0 && `${running} running`,
    failing > 0 && `${failing} failing`,
  ]
    .filter(Boolean)
    .join(" · ")
}

function AgentRow({
  agent,
  runs,
  pending,
  highlight,
  onOpen,
  onToggle,
}: {
  agent: AgentConfig
  runs: AgentRunDoc[]
  pending: boolean
  highlight?: boolean
  onOpen: () => void
  onToggle: (v: boolean) => void
}) {
  const state = agentState(agent, runs)
  const copy = STATE_COPY[state]
  const own = useMemo(() => runs.filter((r) => r.agentName === agent.name), [runs, agent.name])
  const last = own[0]
  const label = agentLabel(agent.name)
  const isOff = state === "off"

  return (
    <div data-agent-row={agent.name} className="group relative isolate flex items-center gap-3 px-3 py-2.5 transition-colors sm:px-4 hover:bg-secondary/40 has-[button[data-row]:focus-visible]:bg-secondary/40">
      {highlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-foreground/[0.07] ring-1 ring-inset ring-foreground/15 animate-[studio-row-return_1.6s_ease-out_both] motion-reduce:animate-none"
        />
      )}
      <button
        type="button"
        data-row
        onClick={onOpen}
        aria-label={`Open ${label}`}
        className="absolute inset-0 focus-visible:outline-none"
      />

      <AgentGlyph name={agent.name} muted={isOff} />

      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-[14px] font-medium", isOff ? "text-muted-foreground" : "text-foreground")}>
            {label}
          </span>
          {state !== "active" && !isOff && (
            <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium", copy.text)}>
              <StatusDot className={copy.dot} pulse={state === "running"} />
              {copy.label}
            </span>
          )}
        </div>
        <p className="truncate text-[13px] text-muted-foreground">{agentTagline(agent)}</p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground md:hidden">
          {isOff ? (
            "Off"
          ) : (
            <>
              <Clock className="size-3 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{scheduleLabel(agent)}</span>
              {last && (
                <span className="shrink-0">
                  <span aria-hidden>· </span>Ran {ago(last.startedAt)}
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="pointer-events-none hidden shrink-0 lg:block" title="Last 14 days">
        <HealthStrip runs={own} />
      </div>

      <div className="pointer-events-none hidden w-44 shrink-0 flex-col gap-0.5 text-[12px] text-muted-foreground md:flex">
        {isOff ? (
          <span>Off</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Clock className="size-3 shrink-0" aria-hidden />
            <span className="truncate" title={scheduleLabel(agent)}>{scheduleLabel(agent)}</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          {last ? (
            <>
              <span className="flex size-3 items-center justify-center">
                <StatusDot className={RUN_STATUS_COPY[last.status]?.dot ?? "bg-muted-foreground/50"} />
              </span>
              <span className="truncate">
                {last.status === "in_progress"
                  ? "Running now"
                  : `${RUN_STATUS_COPY[last.status]?.label ?? "Ran"} ${ago(last.startedAt)}`}
              </span>
            </>
          ) : (
            <span className="pl-[18px] text-muted-foreground/70">No runs yet</span>
          )}
        </span>
      </div>

      <div className="relative z-10 hidden sm:block">
        <Switch
          checked={agent.enabled}
          disabled={pending}
          onCheckedChange={onToggle}
          aria-label={`${agent.enabled ? "Turn off" : "Turn on"} ${label}`}
        />
      </div>
      <ChevronRight className="pointer-events-none size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </div>
  )
}
