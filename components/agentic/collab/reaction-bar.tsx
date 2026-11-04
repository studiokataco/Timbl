"use client"

import { useRef, useState } from "react"
import { SmilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Toggle } from "@/components/ui/toggle"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import { REACTION_EMOJI, REACTION_NAMES } from "../defaults"
import { REDUCED_POPUP, tw } from "../lib"
import type { NoteReaction, ReactionEmoji } from "../types"

type ReactionBarProps = { reactions: NoteReaction[]; viewerId: string; onToggle: (emoji: ReactionEmoji) => void; noteId: string }
type ReactionGridProps = { onPick: (emoji: ReactionEmoji) => void; selected?: ReactionEmoji[] }

const COLUMNS = 4

export function ReactionGrid({ onPick, selected = [] }: ReactionGridProps): React.JSX.Element {
  const { copy } = usePrototype()
  const [focusIndex, setFocusIndex] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (next: number) => {
    const clamped = (next + REACTION_EMOJI.length) % REACTION_EMOJI.length
    setFocusIndex(clamped)
    refs.current[clamped]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }
    if (e.key in delta) {
      e.preventDefault()
      move(focusIndex + delta[e.key])
    } else if (e.key === "Home") {
      e.preventDefault()
      move(0)
    } else if (e.key === "End") {
      e.preventDefault()
      move(REACTION_EMOJI.length - 1)
    }
  }

  return (
    <div
      role="group"
      aria-label={copy.notes.react}
      data-slot="agentic-reaction-grid"
      data-state="open"
      data-figma="ReactionGrid"
      onKeyDown={onKeyDown}
      className="grid grid-cols-4 gap-1"
    >
      {REACTION_EMOJI.map((emoji, i) => (
        <button
          key={emoji}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          tabIndex={i === focusIndex ? 0 : -1}
          aria-label={REACTION_NAMES[emoji]}
          aria-pressed={selected.includes(emoji)}
          onFocus={() => setFocusIndex(i)}
          onClick={() => onPick(emoji)}
          className={tw(
            "grid size-9 place-items-center rounded-md text-body-md hover:bg-muted aria-pressed:bg-muted",
            "focus-ring",
          )}
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
    </div>
  )
}

export function ReactionBar({ reactions, viewerId, onToggle, noteId }: ReactionBarProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const visible = reactions.filter((r) => r.userIds.length > 0)
  const mine = visible.filter((r) => r.userIds.includes(viewerId)).map((r) => r.emoji)

  return (
    <div
      data-slot="agentic-reaction-bar"
      data-state={visible.length === 0 ? "empty" : "reacted"}
      data-figma="ReactionBar"
      data-note-id={noteId}
      className="flex flex-wrap items-center gap-1"
    >
      {visible.map((r) => {
        const pressed = r.userIds.includes(viewerId)
        return (
          <Toggle
            key={r.emoji}
            variant="outline"
            size="sm"
            pressed={pressed}
            onPressedChange={() => onToggle(r.emoji)}
            aria-label={copy.notes.reaction(REACTION_NAMES[r.emoji], r.userIds.length, pressed)}
            data-figma="ReactionBar/reaction"
            className="rounded-md aria-pressed:border-foreground aria-pressed:bg-muted"
          >
            <span aria-hidden>{r.emoji}</span>
            <span aria-hidden className="text-xs">
              {r.userIds.length}
            </span>
          </Toggle>
        )
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button ref={triggerRef} variant="ghost" size="icon-sm" aria-label={copy.notes.react} data-figma="ReactionBar/add">
              <SmilePlus aria-hidden />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          finalFocus={() => triggerRef.current}
          className={tw("w-auto p-2", reduced && REDUCED_POPUP)}
        >
          <ReactionGrid
            selected={mine}
            onPick={(emoji) => {
              onToggle(emoji)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
