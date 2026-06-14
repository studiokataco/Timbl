"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { AgentChat } from "@/components/agents/agent-chat"
import { BrandPreviewPanel } from "@/components/agents/brand-preview-panel"
import { cn } from "@/lib/utils"

export function BrandWizardClient() {
  const queryClient = useQueryClient()
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setPreviewOpen(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  return (
    <div
      className={cn(
        "grid gap-3 min-h-[min(24rem,55vh)]",
        previewOpen ? "lg:grid-cols-[1fr_17rem]" : "grid-cols-1",
      )}
    >
      <section
        aria-label="Brand wizard"
        className="border border-border rounded-xl bg-background flex flex-col overflow-hidden min-h-[min(20rem,48vh)]"
      >
        <AgentChat
          agentName="brand-wizard"
          intro="Hi - I'll capture your brand setup with a short interview. I'll ask one question at a time and save your answers as we go."
          placeholder="Reply to the wizard…"
          className="[&_[role=log]]:px-3 [&_[role=log]]:sm:px-4 [&_[role=log]]:py-4 [&_[role=log]]:space-y-4"
          onFinish={() =>
            queryClient.invalidateQueries({ queryKey: ["brand-config"] })
          }
        />
      </section>

      {previewOpen ? (
        <aside
          aria-label="Brand configuration preview"
          className="border border-border rounded-xl bg-background flex flex-col min-h-0 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            aria-expanded
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary/40 transition-colors shrink-0"
          >
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Configuration preview
            </span>
          </button>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 max-h-[min(16rem,40vh)] lg:max-h-none">
            <BrandPreviewPanel />
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors h-fit"
        >
          <ChevronRight className="size-3.5" />
          Show configuration preview
        </button>
      )}
    </div>
  )
}
