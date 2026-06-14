"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Sparkles } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import { cn } from "@/lib/utils"
import { usePlanFeatures } from "@/lib/plans/client"
import { AGENT_TEMPLATES } from "@/lib/agents/template-catalog"
import { STAGES, stageForAgent, type Stage } from "./stage-map"
import { PROVIDER_TONE } from "./status-tone"
import { AddAgentSheet } from "./add-agent-sheet"

const AGENT_LABELS: Record<string, string> = Object.fromEntries(
  AGENT_TEMPLATES.map((t) => [t.name, t.label ?? t.name]),
)

/*
 * Left rail - agents grouped by pipeline stage.
 *
 * Selection state lives in the URL as `?focus=agent:<name>` so the
 * Inspector (mounted in `studio-workspace`) can read the same source of
 * truth. Click a row -> `router.replace` swaps the param without a full
 * navigation. Free-tier orgs (quotas.agents === 0) get an upgrade nudge
 * instead of the Add agent affordance.
 */
type Props = {
  rosterAgents: AgentConfig[]
  installedAgents: AgentConfig[]
}

export function Roster({ rosterAgents, installedAgents }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const planFeatures = usePlanFeatures()
  const focus = params.get("focus") ?? ""
  const selectedAgent = focus.startsWith("agent:") ? focus.slice(6) : null
  const [addOpen, setAddOpen] = useState(false)

  const isFree = planFeatures.quotas.agents === 0

  const grouped = useMemo(() => {
    const out: Record<Stage, AgentConfig[]> = {
      PLAN: [],
      DRAFT: [],
      REVIEW: [],
      SCHEDULE: [],
      GATE: [],
      CONFIG: [],
      OTHER: [],
    }
    for (const a of rosterAgents) out[stageForAgent(a.name)].push(a)
    return out
  }, [rosterAgents])

  function select(name: string) {
    const next = new URLSearchParams(params.toString())
    if (selectedAgent === name) {
      next.delete("focus")
    } else {
      next.set("focus", `agent:${name}`)
    }
    const qs = next.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  return (
    <nav
      aria-label="Agents"
      className="flex flex-col gap-5 p-4 overflow-y-auto h-full"
    >
      {STAGES.map((stage) => {
        const items = grouped[stage]
        if (items.length === 0) return null
        return (
          <div key={stage} className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
              {stage}
            </p>
            {items.map((agent) => {
              const active = selectedAgent === agent.name
              return (
                <button
                  key={agent.name}
                  type="button"
                  onClick={() => select(agent.name)}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    active ? "bg-secondary" : "hover:bg-secondary/60",
                  )}
                  aria-pressed={active}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full shrink-0 transition-shadow",
                      agent.enabled
                        ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/15"
                        : "bg-border",
                    )}
                  />
                  <span className="flex-1 truncate text-[13px] font-medium text-foreground/90">
                    {AGENT_LABELS[agent.name] ?? agent.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                      PROVIDER_TONE[agent.provider] ??
                        "bg-secondary text-muted-foreground",
                    )}
                  >
                    {agent.provider}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}

      {isFree ? (
        <div className="mt-auto rounded-xl border border-dashed border-border p-3 text-center">
          <Sparkles className="mx-auto size-4 text-muted-foreground/60" />
          <p className="mt-1.5 text-[11.5px] font-medium">Agents need Studio</p>
          <a
            href="/settings/billing"
            className="mt-0.5 inline-block text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Upgrade to unlock
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground hover:border-border/80 transition-colors"
        >
          <Plus className="size-3.5" />
          Add agent
        </button>
      )}

      <AddAgentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        installedAgents={installedAgents}
      />
    </nav>
  )
}
