"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { installDefaultAgents } from "@/lib/actions/agent-configs"
import { BOUTIQUE_TEMPLATES } from "@/lib/agents/template-catalog"
import { AgentGlyph } from "./bits"

export function EmptyRosterCta({ onAdd }: { onAdd: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  function installAll() {
    startTransition(async () => {
      const res = await installDefaultAgents()
      if (!res.ok) {
        toast.error("Couldn't add the starter agents", { description: res.error })
        return
      }
      const n = res.installed?.length ?? 0
      toast.success(n === 0 ? "The starter agents are already added" : `Added ${n} agent${n === 1 ? "" : "s"}`)
      queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <div className="flex -space-x-2" aria-hidden>
        {BOUTIQUE_TEMPLATES.slice(0, 5).map((t) => (
          <span key={t.name} className="rounded-lg bg-background">
            <AgentGlyph name={t.name} />
          </span>
        ))}
      </div>
      <div className="max-w-md space-y-1.5">
        <h2 className="text-title-md text-foreground">Build your agent team</h2>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Agents plan, draft and schedule posts in the background, and ask you before anything is published.
          Start with the recommended set or pick them one at a time.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={installAll} disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          Add the starter set
        </Button>
        <Button variant="outline" onClick={onAdd} disabled={pending}>
          <Plus className="size-3.5" aria-hidden />
          Pick agents
        </Button>
      </div>
      <p className="max-w-[44ch] text-[12px] text-muted-foreground">
        Agents you already have stay as they are. You can change any agent&rsquo;s schedule and instructions later.
      </p>
    </div>
  )
}
