"use client"

import { PanelRightClose, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DisclosureTrigger } from "@/components/ui/disclosure"
import { UnreadDot } from "../collab/unread-dot"
import { usePrototype } from "../prototype-context"

export type OverviewRailProps = {
  period: string
  stats: { scheduled: number; review: number; slots: number; campaigns: number }
  attention: { postId: string; title: string; line: string; unread: { count: number; mentions: number } }[]
  comingUp: { postId: string; title: string; when: string }[]
  onOpenTimbl: () => void
  onOpenPost: (id: string) => void
  onSettings: () => void
  onCollapse?: () => void
  children?: React.ReactNode
}

export function OverviewRail({
  period,
  stats,
  attention,
  comingUp,
  onOpenTimbl,
  onOpenPost,
  onSettings,
  onCollapse,
  children,
}: OverviewRailProps): React.JSX.Element {
  const { copy, disclosure, setDisclosure } = usePrototype()
  const r = copy.iface.rail
  const attOpen = disclosure["rail:attention"] ?? true
  const upOpen = disclosure["rail:coming"] ?? true
  const weekOpen = disclosure["rail:week"] ?? true
  const weekStats = [
    { value: stats.scheduled, label: r.stats.scheduled },
    { value: stats.review, label: r.stats.review },
    { value: stats.slots, label: r.stats.slots },
    { value: stats.campaigns, label: r.stats.campaigns },
  ]

  return (
    <aside
      aria-label={r.title}
      data-slot="agentic-overview-rail"
      data-state={attention.length > 0 ? "attention" : "clear"}
      data-figma="OverviewRail/root"
      className="flex min-h-0 w-80 shrink-0 flex-col gap-6 overflow-y-auto overscroll-contain border-l border-border bg-background p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-title-sm text-foreground">{r.title}</h2>
          <p className="text-caption text-muted-foreground tabular-nums">{period}</p>
        </div>
        <div className="flex items-center gap-1">
          {onCollapse ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={r.collapse} onClick={onCollapse}>
              <PanelRightClose className="size-4" aria-hidden />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon-sm" aria-label={r.settings} onClick={onSettings}>
            <Settings2 className="size-4" aria-hidden />
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <DisclosureTrigger
            open={attOpen}
            onOpenChange={(next) => setDisclosure("rail:attention", next)}
            controls="rail-sec-attention"
            className="text-body-sm font-medium text-foreground"
          >
            {r.attention}
          </DisclosureTrigger>
          {attention.length > 0 ? (
            <span className="text-caption text-muted-foreground tabular-nums">{attention.length}</span>
          ) : null}
        </div>
        {attOpen ? (
          attention.length === 0 ? (
            <p id="rail-sec-attention" className="text-caption text-muted-foreground">{r.attentionEmpty}</p>
          ) : (
            <ul id="rail-sec-attention" className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {attention.map((item) => (
                <li key={item.postId}>
                  <button
                    type="button"
                    onClick={() => onOpenPost(item.postId)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-2 text-body-sm font-medium text-foreground">{item.title}</span>
                      <span className="text-caption text-muted-foreground">{item.line}</span>
                    </span>
                    <UnreadDot count={item.unread.count} mentions={item.unread.mentions} className="mt-1" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <DisclosureTrigger
          open={upOpen}
          onOpenChange={(next) => setDisclosure("rail:coming", next)}
          controls="rail-sec-coming"
          className="text-body-sm font-medium text-foreground"
        >
          {r.comingUp}
        </DisclosureTrigger>
        {upOpen ? (
          <ul id="rail-sec-coming" className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {comingUp.map((item) => (
              <li key={item.postId}>
                <button
                  type="button"
                  onClick={() => onOpenPost(item.postId)}
                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="text-caption text-muted-foreground tabular-nums">{item.when}</span>
                  <span className="line-clamp-2 text-body-sm font-medium text-foreground">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <DisclosureTrigger
          open={weekOpen}
          onOpenChange={(next) => setDisclosure("rail:week", next)}
          controls="rail-sec-week"
          className="text-body-sm font-medium text-foreground"
        >
          {r.week}
        </DisclosureTrigger>
        {weekOpen ? (
          <div id="rail-sec-week" className="grid grid-cols-2 gap-x-4 gap-y-2">
            {weekStats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="text-title-sm text-foreground tabular-nums">{stat.value}</span>
                <span className="text-caption text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <Button type="button" variant="outline" size="sm" onClick={onOpenTimbl} className="w-fit">
        {r.promoCta}
      </Button>
      {children}
    </aside>
  )
}
