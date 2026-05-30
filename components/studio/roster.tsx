"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import { cn } from "@/lib/utils"
import { STAGES, stageForAgent, type Stage } from "./stage-map"
import { PROVIDER_TONE } from "./status-tone"
import { AddAgentSheet } from "./add-agent-sheet"
import { ModelUpdatesCard } from "./model-updates-card"

/*
 * Left rail - agents grouped by pipeline stage.
 *
 * Selection state lives in the URL as `?focus=agent:<name>` so the
 * Inspector (mounted in `studio-workspace`) can read the same source of
 * truth. Click a row → `router.replace` swaps the param without a full
 * navigation.
 */
type Props = {
  agents: AgentConfig[]
}

export function Roster({ agents }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const focus = params.get("focus") ?? ""
  const selectedAgent = focus.startsWith("agent:") ? focus.slice(6) : null
  const [addOpen, setAddOpen] = useState(false)

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
    for (const a of agents) out[stageForAgent(a.name)].push(a)
    return out
  }, [agents])

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
          <div key={stage} className="flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 pb-1.5">
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
                    "group relative flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
                    active
                      ? "bg-secondary"
                      : "hover:bg-secondary/60",
                  )}
                  aria-pressed={active}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      agent.enabled
                        ? "bg-emerald-500"
                        : "bg-border",
                    )}
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm truncate",
                      active
                        ? "text-foreground font-medium"
                        : "text-foreground/90 font-medium",
                    )}
                  >
                    {agent.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wide rounded-pill px-1.5 py-0.5 shrink-0",
                      PROVIDER_TONE[agent.provider] ?? "bg-secondary text-muted-foreground",
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

      <ModelUpdatesCard />

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="mt-auto flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
      >
        <Plus className="size-3.5" />
        Add agent
      </button>

      <AddAgentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        installedAgents={agents}
      />
    </nav>
  )
}
