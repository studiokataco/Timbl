"use client"

import { useId } from "react"
import { ListFilter, PanelRightClose, Settings2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { UnreadDot } from "../collab/unread-dot"
import { usePrototype } from "../prototype-context"

export type OverviewRailProps = {
  period: string
  stats: { scheduled: number; review: number; slots: number; campaigns: number }
  attention: { postId: string; title: string; line: string; unread: { count: number; mentions: number } }[]
  comingUp: { postId: string; title: string; when: string }[]
  categoryFilter?: React.ReactNode
  categorySummary: string | null
  density?: "touch" | "pointer"
  onOpenActivity: () => void
  onOpenPost: (id: string) => void
  onSettings: () => void
  onClose?: () => void
  onCollapse?: () => void
}

export function OverviewRail({
  period,
  stats,
  attention,
  comingUp,
  categoryFilter,
  categorySummary,
  density = "pointer",
  onOpenActivity,
  onOpenPost,
  onSettings,
  onClose,
  onCollapse,
}: OverviewRailProps): React.JSX.Element {
  const { copy } = usePrototype()
  const r = copy.iface.rail
  const id = useId()
  const attentionTitleId = `${id}-attention-title`
  const comingTitleId = `${id}-coming-title`
  const weekTitleId = `${id}-week-title`
  const weekStats = [
    { value: stats.scheduled, label: r.stats.scheduled },
    { value: stats.review, label: r.stats.review },
    { value: stats.slots, label: r.stats.slots },
    { value: stats.campaigns, label: r.stats.campaigns },
  ]
  const visibleAttention = attention.slice(0, 3)
  const iconSize = density === "touch" ? "icon-lg" : "icon-sm"
  const touchTarget = density === "touch" ? "size-11" : undefined

  return (
    <aside
      aria-label={r.title}
      data-slot="agentic-overview-rail"
      data-state={attention.length > 0 ? "attention" : "clear"}
      data-figma="OverviewRail/root"
      className="flex h-full min-h-0 w-full min-w-0 flex-col gap-5 overflow-y-auto overscroll-contain border-l border-border bg-background p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-title-sm text-foreground">{r.title}</h2>
          <p className="text-caption tabular-nums text-muted-foreground">{period}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Popover>
            <PopoverTrigger render={<Button type="button" variant="ghost" size={iconSize} className={touchTarget} aria-label={r.categories} /> }>
              <ListFilter className="size-4" aria-hidden />
            </PopoverTrigger>
            <PopoverContent align="end" side={density === "touch" ? "bottom" : "left"} className="max-h-[min(28rem,80vh)] w-[min(16rem,calc(100vw-1rem))] overflow-y-auto">
              <PopoverHeader>
                <PopoverTitle>{r.categories}</PopoverTitle>
                {categorySummary ? <p className="text-xs text-muted-foreground">{categorySummary}</p> : null}
              </PopoverHeader>
              {categoryFilter}
            </PopoverContent>
          </Popover>
          {onCollapse ? (
            <Button type="button" variant="ghost" size={iconSize} className={touchTarget} aria-label={r.collapse} onClick={onCollapse}>
              <PanelRightClose className="size-4" aria-hidden />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size={iconSize} className={touchTarget} aria-label={r.settings} onClick={onSettings}>
            <Settings2 className="size-4" aria-hidden />
          </Button>
          {onClose ? (
            <Button type="button" variant="ghost" size={iconSize} className={touchTarget} aria-label={r.close} onClick={onClose}>
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </header>

      <section aria-labelledby={attentionTitleId} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id={attentionTitleId} className="text-body-sm font-medium text-foreground">{r.attention}</h3>
          {attention.length > 0 ? (
            <span className="text-caption tabular-nums text-muted-foreground">{attention.length}</span>
          ) : null}
        </div>
        {attention.length === 0 ? (
          <p className="text-caption text-muted-foreground">{r.attentionEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {visibleAttention.map((item) => (
              <li key={item.postId}>
                <button
                  type="button"
                  onClick={() => onOpenPost(item.postId)}
                  className="flex w-full items-start gap-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-ring"
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
        )}
        {attention.length > visibleAttention.length ? (
          <Button type="button" variant="link" size="sm" onClick={onOpenActivity} className="h-auto self-start px-0 py-1">
            {r.attentionMore(attention.length - visibleAttention.length)}
          </Button>
        ) : null}
      </section>

      <section aria-labelledby={comingTitleId} className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 id={comingTitleId} className="text-body-sm font-medium text-foreground">{r.comingUp}</h3>
        {comingUp.length === 0 ? (
          <p className="text-caption text-muted-foreground">{r.comingEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {comingUp.map((item) => (
              <li key={item.postId}>
                <button
                  type="button"
                  onClick={() => onOpenPost(item.postId)}
                  className="flex w-full flex-col gap-0.5 py-2.5 text-left transition-colors hover:bg-muted/50 focus-ring"
                >
                  <span className="text-caption tabular-nums text-muted-foreground">{item.when}</span>
                  <span className="line-clamp-2 text-body-sm font-medium text-foreground">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={weekTitleId} className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 id={weekTitleId} className="text-body-sm font-medium text-foreground">{r.week}</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {weekStats.map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-2">
              <dt className="order-2 text-caption text-muted-foreground">{stat.label}</dt>
              <dd className="order-1 text-title-sm tabular-nums text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

    </aside>
  )
}
