"use client"

import { useEffect, useId, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { AgentChat } from "@/components/agents/agent-chat"
import { BrandPreviewPanel } from "@/components/agents/brand-preview-panel"
import { DisclosureTrigger } from "@/components/ui/disclosure"
import { cn } from "@/lib/utils"

export function BrandWizardClient({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient()
  const [previewOpen, setPreviewOpen] = useState(false)
  const bodyId = useId()

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

      <aside
        aria-label="Saved brand details"
        className={cn(
          "border border-border bg-background flex flex-col min-h-0 overflow-hidden",
          previewOpen ? "rounded-xl" : "rounded-lg h-fit",
        )}
      >
        <DisclosureTrigger
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          controls={bodyId}
          chevronClassName="size-3.5"
          className="px-3 py-2 hover:bg-secondary/40 shrink-0"
        >
          <span className="text-sm font-medium text-foreground">
            Saved so far
          </span>
        </DisclosureTrigger>
        <div
          id={bodyId}
          hidden={!previewOpen}
          className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 max-h-[min(16rem,40vh)] lg:max-h-none"
        >
          {previewOpen && <BrandPreviewPanel brandId={brandId} />}
        </div>
      </aside>
    </div>
  )
}
