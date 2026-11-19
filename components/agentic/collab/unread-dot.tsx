"use client"

import { AtSign } from "lucide-react"
import { usePrototype } from "../prototype-context"
import { tw } from "../lib"

type UnreadDotProps = { count: number; mentions?: number; className?: string }

export function UnreadDot({ count, mentions = 0, className }: UnreadDotProps): React.JSX.Element | null {
  const { copy } = usePrototype()
  if (count === 0) return null
  const mentioned = mentions > 0
  return (
    <span
      data-slot="agentic-unread-dot"
      data-state={mentioned ? "mention" : "count"}
      data-figma="UnreadDot"
      className={tw("inline-flex shrink-0 items-center", className)}
    >
      {mentioned ? (
        <span aria-hidden className="grid size-4 place-items-center rounded-full bg-brand-accent text-accent-foreground">
          <AtSign className="size-3" />
        </span>
      ) : (
        <span aria-hidden className="size-2 rounded-full bg-brand-accent" />
      )}
      <span className="sr-only">{mentioned ? copy.notes.mentionDot : copy.notes.unreadDot(count)}</span>
    </span>
  )
}
