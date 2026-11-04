"use client"

import { Lock } from "lucide-react"
import { CHANNEL_LABELS } from "@/lib/labels/enums"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDay } from "../clock"
import { AgenticCard, type AgenticCardProps } from "../primitives/agentic-card"
import { ChannelMark } from "../primitives/channel-mark"
import { usePrototype } from "../prototype-context"
import type { CardStatus, ChannelKey, PrototypePost, ScheduleSlot } from "../types"

export type ScheduleCardProps = {
  slots: ScheduleSlot[]
  posts: Record<string, PrototypePost>
  status: CardStatus
  onEditSlot: (i: number, patch: Partial<ScheduleSlot>) => void
  onConfirm: () => void
  onCadence: () => void
  onGoToApproval?: () => void
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  disabled?: boolean
  disabledReason?: string
}

const CHANNELS: ChannelKey[] = ["instagram", "linkedin", "x", "facebook"]

export function ScheduleCard({
  slots,
  posts,
  status,
  onEditSlot,
  onConfirm,
  onCadence,
  onGoToApproval,
  error,
  cap,
  disabled,
  disabledReason,
}: ScheduleCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.schedule
  const needsYou = status === "needs_you"
  const channelItems = CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] }))

  return (
    <AgenticCard
      id="schedule"
      meta={copy.canvas.meta.schedule}
      title={c.title}
      status={status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={status === "done" ? c.done(slots.length) : undefined}
      footnote={{ icon: Lock, text: c.guardrail }}
      primary={
        needsYou
          ? { label: c.waiting, onClick: () => {}, disabled: true, disabledReason: c.waiting }
          : status === "ready"
            ? { label: c.primary, onClick: onConfirm }
            : undefined
      }
      secondary={
        needsYou
          ? { label: c.goToApproval, onClick: () => onGoToApproval?.() }
          : status === "ready"
            ? { label: c.secondary, onClick: onCadence }
            : undefined
      }
      figmaName="ScheduleCard"
    >
      <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface-soft/30">
        {slots.map((slot, index) => {
          const post = posts[slot.postId]
          return (
            <li
              key={`${slot.postId}-${index}`}
              data-figma={`ScheduleCard/slot-${index + 1}`}
              className="flex h-16 items-center gap-3 px-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="w-5 shrink-0 font-mono text-caption font-medium text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-title-sm text-foreground">{formatDay(slot.date)}</span>
                  <span className="truncate text-caption text-muted-foreground">{post?.brief ?? c.slot(index + 1)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Input
                  type="time"
                  aria-label={c.timeFor(index + 1)}
                  value={slot.time}
                  onChange={(e) => onEditSlot(index, { time: e.target.value })}
                  className="w-[9.5rem] min-w-[9.5rem] shrink-0 rounded-md bg-background px-2.5 tabular-nums"
                />
                <Select
                  items={channelItems}
                  value={slot.channel}
                  onValueChange={(v) => v && onEditSlot(index, { channel: v as ChannelKey })}
                >
                  <SelectTrigger aria-label={c.channelFor(index + 1)} className="w-[8.5rem] shrink-0 gap-2 rounded-md bg-background">
                    <ChannelMark channel={slot.channel} className="size-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        <span className="inline-flex items-center gap-2">
                          <ChannelMark channel={ch} className="size-3.5" />
                          {CHANNEL_LABELS[ch]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          )
        })}
      </ol>
    </AgenticCard>
  )
}
