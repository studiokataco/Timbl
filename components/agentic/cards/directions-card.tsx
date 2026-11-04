"use client"

import { ArrowUpRight, Check } from "lucide-react"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { AgenticCard, type AgenticCardProps } from "../primitives/agentic-card"
import { PreviewTile } from "../primitives/preview-tile"
import { tw } from "../lib"
import { usePrototype } from "../prototype-context"
import type { CardStatus } from "../types"

export type DirectionsCardProps = {
  ideas: IdeationItem[]
  selectedId: string
  status: CardStatus
  onSelect: (id: string) => void
  onBuild: () => void
  onCompare: () => void
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  summary?: string
  disabled?: boolean
  disabledReason?: string
}

export function DirectionsCard({
  ideas,
  selectedId,
  status,
  onSelect,
  onBuild,
  onCompare,
  error,
  cap,
  summary,
  disabled,
  disabledReason,
}: DirectionsCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.directions
  const selected = ideas.find((i) => i.id === selectedId) ?? ideas[0]

  const onRadioKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = ideas.findIndex((i) => i.id === selectedId)
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault()
      const next = ideas[(idx + 1) % ideas.length]
      if (next) onSelect(next.id)
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault()
      const prev = ideas[(idx - 1 + ideas.length) % ideas.length]
      if (prev) onSelect(prev.id)
    }
  }

  return (
    <AgenticCard
      id="directions"
      meta={copy.canvas.meta.directions}
      title={c.title}
      status={status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={summary ?? (status === "done" && selected ? c.done(selected.title) : undefined)}
      primary={status === "ready" || status === "needs_you" ? { label: c.primary, icon: ArrowUpRight, onClick: onBuild } : undefined}
      secondary={status === "ready" || status === "needs_you" ? { label: c.secondary, onClick: onCompare } : undefined}
      figmaName="DirectionsCard"
    >
      <div className="flex flex-col gap-5">
        <div
          role="radiogroup"
          aria-label={c.groupLabel}
          onKeyDown={onRadioKeyDown}
          className="flex flex-col gap-2.5"
        >
          {ideas.map((idea, index) => {
            const on = idea.id === selectedId
            return (
              <button
                key={idea.id}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect(idea.id)}
                data-figma={`DirectionsCard/option-${index + 1}`}
                className={tw(
                  "flex items-start gap-3 rounded-xl p-3.5 text-left focus-ring",
                  on ? "bg-background ring-2 ring-foreground" : "bg-card ring-1 ring-foreground/10",
                )}
              >
                <span className="mt-0.5 text-caption font-medium text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-title-sm text-foreground">{idea.title}</span>
                  <span className="mt-0.5 block text-caption text-muted-foreground">{idea.summary}</span>
                </span>
                {on ? <Check className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden /> : null}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-caption font-medium text-muted-foreground">{c.tilesTitle}</span>
          <div className="grid grid-cols-1 gap-3 @md/card:grid-cols-3">
            {ideas.slice(0, 3).map((idea, index) => {
              const format = c.formats[index] ?? c.formats[0]!
              const headline =
                idea.nextAction?.payload && "tileHeadline" in idea.nextAction.payload
                  ? String(idea.nextAction.payload.tileHeadline)
                  : idea.title
              return (
                <PreviewTile
                  key={idea.id}
                  size="sm"
                  tile={{ headline, format }}
                  alt={c.tileAlt(headline)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </AgenticCard>
  )
}
