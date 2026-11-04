"use client"

import { CircleCheck, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TONE_DOT, tw } from "../lib"
import { weekShort } from "../clock"
import { usePrototype } from "../prototype-context"
import type { GlanceCard, GlanceTarget } from "../types"

export type GlanceHomeProps = {
  cards: GlanceCard[]
  status: string
  framed?: boolean
  onAction: (target: GlanceTarget) => void
  onAsk: () => void
  onSpeak: () => void
}

export function GlanceHome({
  cards,
  status,
  framed = true,
  onAction,
  onAsk,
  onSpeak,
}: GlanceHomeProps): React.JSX.Element {
  const { copy, view } = usePrototype()
  const g = copy.mobile.glance

  return (
    <div
      data-slot="agentic-glance-home"
      data-state={cards.length === 0 ? "all-clear" : "active"}
      data-figma="GlanceHome/root"
      className={tw("flex min-h-full flex-col bg-background px-6 pb-6 text-foreground", framed ? "pt-16" : "pt-6")}
    >
      <header data-figma="GlanceHome/header" className="flex flex-col gap-1.5 px-1">
        <h1 className="text-display-sm text-balance text-foreground">{g.greeting(weekShort(view.week))}</h1>
        <p className="text-body-md text-muted-foreground">{status}</p>
      </header>

      <div data-figma="GlanceHome/list" className="flex flex-1 flex-col gap-3 pt-6">
        {cards.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-border p-6 text-center">
            <CircleCheck className="size-4 text-success" aria-hidden />
            <p className="text-body-md font-medium text-foreground">{g.allClear}</p>
          </div>
        ) : (
          cards.slice(0, 3).map((card) => {
            const headingId = `glance-h-${card.id}`
            return (
              <section
                key={card.id}
                aria-labelledby={headingId}
                data-figma={`GlanceHome/${card.id}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={tw(
                      "size-2 shrink-0 rounded-full",
                      card.tone === "warning" || card.tone === "destructive" ? TONE_DOT[card.tone] : "bg-muted-foreground",
                    )}
                  />
                  <h2 id={headingId} className="text-body-sm font-medium text-foreground">
                    {card.title}
                  </h2>
                </div>
                {card.line ? <p className="text-body-sm text-muted-foreground">{card.line}</p> : null}
                {(card.primary || card.secondary) ? (
                  <div className="flex gap-2">
                    {card.primary ? (
                      <Button
                        data-figma={`GlanceHome/${card.id}/primary`}
                        className="h-11 flex-1"
                        onClick={() => onAction(card.primary!.target)}
                      >
                        {card.primary.label}
                      </Button>
                    ) : null}
                    {card.secondary ? (
                      <Button
                        variant="outline"
                        data-figma={`GlanceHome/${card.id}/secondary`}
                        className="h-11 flex-1"
                        onClick={() => onAction(card.secondary!.target)}
                      >
                        {card.secondary.label}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            )
          })
        )}
      </div>

      <div
        data-figma="GlanceHome/askBar"
        className="mt-4 flex items-center gap-2 rounded-xl border border-input bg-background p-1.5 pl-4"
      >
        <button
          type="button"
          aria-label={g.ask}
          onClick={onAsk}
          className="h-12 flex-1 text-left text-body-md text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {g.ask}
        </button>
        <Button
          type="button"
          aria-label={g.speak}
          onClick={onSpeak}
          className="size-12 shrink-0 rounded-lg"
        >
          <Mic className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
