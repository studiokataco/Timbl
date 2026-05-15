"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { X } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/lib/hooks/use-media-query"

import { Roster } from "./roster"
import { PipelineGraph } from "./pipeline-graph"
import { ActivityStream } from "./activity-stream"
import { Inspector } from "./inspector"

/*
 * Three-column workspace for /studio.
 *
 *   ≥1280px   →  roster (260px) | center (flex) | inspector (380px)
 *   768–1279  →  roster | center; inspector collapses to a slide-over Sheet
 *                triggered automatically whenever `?focus=` is set.
 *   <768px    →  roster becomes a horizontal pill strip across the top of
 *                the center column; pipeline scrolls horizontally; inspector
 *                is a full-screen sheet.
 *
 * URL is the source of truth for selection — `?focus=agent:<name>` /
 * `?focus=run:<id>` / `?focus=ideation:<id>`. Components below read it
 * directly via useSearchParams.
 */
type Props = {
  agents: AgentConfig[]
  runs: AgentRunDoc[]
  ideation: IdeationItem[]
  publishCounts?: { scheduled: number; posted: number }
}

export function StudioWorkspace({ agents, runs, ideation, publishCounts }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const focus = params.get("focus") ?? ""
  const hasFocus = focus.length > 0
  // `xl` breakpoint matches Tailwind's default (1280px). At this width and
  // above the inspector is rendered inline as the third column, so the
  // Sheet must NOT mount — otherwise its backdrop portal dims the whole
  // page even though SheetContent has `xl:hidden` (the overlay is a
  // sibling element and ignores that class).
  const isWide = useMediaQuery("(min-width: 1280px)")
  const showSheet = hasFocus && !isWide

  // Inspector sheet (tablet/mobile) is open iff the URL carries `?focus=`.
  // The persistent right rail (≥1280px) renders the same Inspector inline.
  function closeFocus() {
    const next = new URLSearchParams(params.toString())
    next.delete("focus")
    const qs = next.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_380px] divide-x divide-border">
      {/* Roster (left rail) */}
      <aside className="hidden md:block min-h-0 overflow-hidden">
        <Roster agents={agents} />
      </aside>

      {/* Mobile roster — horizontal scroll strip */}
      <div className="md:hidden border-b border-border bg-background overflow-x-auto">
        <MobileRosterStrip agents={agents} />
      </div>

      {/* Center column */}
      <main className="min-h-0 overflow-y-auto">
        <PageHero />
        <PipelineGraph
          agents={agents}
          runs={runs}
          initialPublishCounts={publishCounts}
        />
        <ActivityStream initialRuns={runs} initialIdeation={ideation} />
      </main>

      {/* Inspector — persistent on wide screens (≥1280px) */}
      <aside className="hidden xl:block min-h-0 overflow-hidden bg-background">
        <Inspector agents={agents} runs={runs} ideation={ideation} />
      </aside>

      {/* Inspector — slide-over on tablet/mobile. Gated by JS media query
          so the Sheet (and its backdrop portal) never mount at ≥1280px. */}
      {!isWide && (
        <Sheet
          open={showSheet}
          onOpenChange={(open) => {
            if (!open) closeFocus()
          }}
        >
          <SheetContent
            side="right"
            className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col bg-background text-foreground"
            showCloseButton={false}
          >
            <SheetHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between gap-2 space-y-0">
              <SheetTitle className="text-title-sm">Inspector</SheetTitle>
              <button
                type="button"
                onClick={closeFocus}
                aria-label="Close inspector"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                <X className="size-4" aria-hidden />
              </button>
            </SheetHeader>
            <div className="flex-1 min-h-0">
              <Inspector agents={agents} runs={runs} ideation={ideation} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function PageHero() {
  return (
    <header className="px-6 pt-8 pb-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        AI Command Center
      </p>
      <h1 className="mt-2 text-display-sm text-foreground">Studio</h1>
      <p className="mt-2 text-body-sm text-muted-foreground max-w-2xl">
        Watch agents move work from idea to schedule, and approve the steps
        that need a human in the loop.
      </p>
    </header>
  )
}

/* ---------------- Mobile-only roster strip ---------------- */

function MobileRosterStrip({ agents }: { agents: AgentConfig[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const focus = params.get("focus") ?? ""
  const selected = focus.startsWith("agent:") ? focus.slice(6) : null

  function select(name: string) {
    const next = new URLSearchParams(params.toString())
    if (selected === name) next.delete("focus")
    else next.set("focus", `agent:${name}`)
    const qs = next.toString()
    router.replace(qs ? `/studio?${qs}` : "/studio", { scroll: false })
  }

  return (
    <div className="flex gap-1.5 px-4 py-3 min-w-max">
      {agents.map((a) => {
        const active = selected === a.name
        return (
          <button
            key={a.name}
            type="button"
            onClick={() => select(a.name)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] transition-colors ${
              active
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:bg-secondary/60"
            }`}
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${
                a.enabled ? "bg-emerald-500" : "bg-border"
              }`}
            />
            {a.name}
          </button>
        )
      })}
    </div>
  )
}
