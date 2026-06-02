"use client"

import { useQueryClient } from "@tanstack/react-query"

import { AgentChat } from "@/components/agents/agent-chat"
import { BrandPreviewPanel } from "@/components/agents/brand-preview-panel"

/*
 * Two-pane layout: wizard chat on the left, live brandConfig preview on
 * the right. Collapses to single column on narrow viewports - the chat is
 * the primary surface; the preview is supporting context.
 *
 * After every stream finishes (any tool call may have written), we
 * invalidate the brand-config query so the preview updates immediately
 * even if the user hasn't ticked the auto-refetch interval.
 */

export function BrandWizardClient() {
  const queryClient = useQueryClient()
  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-4">
      <section
        aria-label="Brand wizard"
        className="border border-border rounded-xl bg-background flex flex-col min-h-0 overflow-hidden"
      >
        <AgentChat
          agentName="brand-wizard"
          intro="Hi - I'll capture your brand setup with a short interview. I'll ask one question at a time and save your answers as we go."
          placeholder="Reply to the wizard…"
          onFinish={() =>
            queryClient.invalidateQueries({ queryKey: ["brand-config"] })
          }
        />
      </section>
      <aside
        aria-label="Brand configuration preview"
        className="border border-border rounded-xl bg-background p-4 h-fit lg:sticky lg:top-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto"
      >
        <h2 className="text-title-sm text-foreground mb-3">Configuration preview</h2>
        <BrandPreviewPanel />
      </aside>
    </div>
  )
}
