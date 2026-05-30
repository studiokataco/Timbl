"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { installDefaultAgents } from "@/lib/actions/agent-configs"
import { AGENT_TEMPLATES } from "@/lib/agents/template-catalog"
import { AddAgentSheet } from "./add-agent-sheet"
import type { AgentConfig } from "@/lib/schemas/agentConfig"

/*
 * Center-column empty state shown by `studio-workspace` when the org has no
 * agent configs yet. Lets the admin one-tap install the full default set
 * (13 templates) or open the picker to add a single agent.
 */

interface Props {
  agents: AgentConfig[] // for the picker - usually [] when this renders
}

export function EmptyRosterCta({ agents }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [addOpen, setAddOpen] = useState(false)

  function installAll() {
    startTransition(async () => {
      const res = await installDefaultAgents()
      if (res.ok) {
        const n = res.installed?.length ?? 0
        toast.success(
          n === 0
            ? "All defaults are already installed"
            : `Installed ${n} default agent${n === 1 ? "" : "s"}`,
        )
        queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
        router.refresh()
      } else {
        toast.error("Install failed", { description: res.error })
      }
    })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-16 gap-6">
      <div className="max-w-md text-center flex flex-col items-center gap-3">
        <div className="size-12 rounded-full bg-secondary flex items-center justify-center">
          <Sparkles className="size-5 text-muted-foreground" />
        </div>
        <h2 className="font-heading text-title-lg text-foreground">
          No agents yet
        </h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[42ch]">
          Studio orchestrates {AGENT_TEMPLATES.length} pre-built agents that
          plan, draft, review, and schedule your posts. Install the default
          set in one click, or add them one at a time.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={installAll} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          <span className="ml-1.5">Install default agents</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setAddOpen(true)}
          disabled={pending}
        >
          <Plus className="size-3.5" />
          <span className="ml-1.5">Add one at a time</span>
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground/80 max-w-[42ch] text-center">
        Each install is idempotent - agents you already have stay untouched.
        You can edit prompts, models, and budgets anytime from Settings →
        Agents.
      </p>

      <AddAgentSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        installedAgents={agents}
      />
    </div>
  )
}
