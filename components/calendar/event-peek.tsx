"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { postStatusLabel } from "@/lib/labels/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DisclosureTrigger } from "@/components/ui/disclosure"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatWhen } from "@/components/agentic/clock"
import { primaryChannel, REDUCED_POPUP, tw } from "@/components/agentic/lib"
import { ChannelMark } from "@/components/agentic/primitives/channel-mark"
import { useAgenticMotion, usePrototype } from "@/components/agentic/prototype-context"
import type { PrototypePost, TeamMember } from "@/components/agentic/types"

export type EventPeekPanelProps = {
  post: PrototypePost
  unread: { count: number; mentions: number }
  editingBy?: TeamMember
  onAskAbout: () => void
  onOpenNotes: () => void
}

export function EventPeekPanel({
  post,
  unread,
  editingBy,
  onAskAbout,
  onOpenNotes,
}: EventPeekPanelProps): React.JSX.Element {
  const { copy } = usePrototype()
  const [expanded, setExpanded] = useState(false)
  const channel = primaryChannel(post)
  const c = copy.iface.calendar
  const long = (post.blurb ?? "").length > 120

  return (
    <div
      data-slot="agentic-event-peek"
      data-state={post.status}
      className="flex w-80 flex-col gap-3 p-4 text-foreground"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-title-sm text-foreground">{post.brief}</h3>
        <Badge variant="outline">{postStatusLabel(post.status)}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <ChannelMark channel={channel} />
        <span className="text-caption text-muted-foreground">
          {formatWhen(post.scheduledDate, post.scheduledTime ?? "09:00")}
        </span>
      </div>
      <p id={`peek-blurb-${post.id}`} className={tw("text-body-sm text-foreground", !expanded && long && "line-clamp-3")}>
        {post.blurb}
      </p>
      {long ? (
        <DisclosureTrigger open={expanded} onOpenChange={setExpanded} controls={`peek-blurb-${post.id}`}>
          {expanded ? copy.cards.shell.showLess : copy.cards.shell.showMore}
        </DisclosureTrigger>
      ) : null}
      {unread.count > 0 ? (
        <p className="text-caption text-muted-foreground">{copy.notes.unread(unread.count)}</p>
      ) : null}
      {editingBy ? (
        <p className="text-caption font-medium text-foreground">{c.editingLine(editingBy.name)}</p>
      ) : null}
      <div className="mt-1 flex gap-2">
        <Button className="flex-1" onClick={onAskAbout}>
          <Sparkles className="size-4" aria-hidden />
          <span>{c.peekPrimary}</span>
        </Button>
        <Button variant="outline" onClick={onOpenNotes}>
          {c.peekSecondary}
        </Button>
      </div>
    </div>
  )
}

export function EventPeek({
  open,
  onOpenChange,
  trigger,
  postId,
  ...panelProps
}: EventPeekPanelProps & {
  open: boolean
  onOpenChange: (o: boolean) => void
  trigger: React.ReactElement
  postId: string
}): React.JSX.Element {
  const { reduced } = useAgenticMotion()
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side="bottom"
        align="start"
        finalFocus={() => document.querySelector<HTMLElement>(`[data-post-id="${postId}"]`)}
        className={tw("w-80 p-0", reduced && REDUCED_POPUP)}
      >
        <EventPeekPanel {...panelProps} />
      </PopoverContent>
    </Popover>
  )
}
