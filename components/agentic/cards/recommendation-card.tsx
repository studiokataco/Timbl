"use client"

import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { AgenticCard, type AgenticCardProps } from "../primitives/agentic-card"
import { PreviewTile } from "../primitives/preview-tile"
import { RichText } from "../primitives/transcript"
import { usePrototype } from "../prototype-context"
import type { CardStatus } from "../types"

export type RecommendationCardProps = {
  idea: IdeationItem
  alternate: IdeationItem
  status: CardStatus
  onUse: () => void
  onKeepExploring: () => void
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  disabled?: boolean
  disabledReason?: string
}

export function RecommendationCard({
  idea,
  alternate,
  status,
  onUse,
  onKeepExploring,
  error,
  cap,
  disabled,
  disabledReason,
}: RecommendationCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.recommendation
  const headline =
    idea.nextAction?.payload && "tileHeadline" in idea.nextAction.payload
      ? String(idea.nextAction.payload.tileHeadline)
      : idea.title

  return (
    <AgenticCard
      id="recommendation"
      meta={copy.canvas.meta.recommendation}
      title={c.title}
      status={status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={status === "done" ? c.done(idea.title) : undefined}
      primary={status === "ready" || status === "needs_you" ? { label: c.primary, onClick: onUse } : undefined}
      secondary={status === "ready" || status === "needs_you" ? { label: c.secondary, onClick: onKeepExploring } : undefined}
      figmaName="RecommendationCard"
    >
      <div className="grid grid-cols-1 gap-4 @xl/card:grid-cols-3">
        <div className="flex flex-col gap-3 @xl/card:col-span-2">
          <p className="text-body-md text-foreground">
            <RichText text={c.body(idea.title)} />
          </p>
          <p className="text-body-sm text-muted-foreground">{idea.summary}</p>
          <p className="text-caption text-muted-foreground">{c.supporting(alternate.title)}</p>
        </div>
        <div className="mx-auto w-44 @xl/card:w-full">
          <PreviewTile
            size="md"
            tile={{ headline, format: copy.cards.directions.formats[0]! }}
            alt={copy.cards.directions.tileAlt(headline)}
          />
        </div>
      </div>
    </AgenticCard>
  )
}
