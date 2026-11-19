"use client"

import { useId } from "react"
import { Check } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { formatWhen } from "../clock"
import { UnreadDot } from "../collab/unread-dot"
import { primaryChannel } from "../lib"
import { AgenticCard, type AgenticCardProps } from "../primitives/agentic-card"
import { ChannelMark } from "../primitives/channel-mark"
import { PreviewTile } from "../primitives/preview-tile"
import { usePrototype } from "../prototype-context"
import type { CardStatus, PrototypePost, UserRole } from "../types"

export type DraftsCardProps = {
  posts: PrototypePost[]
  activeIndex: number
  status: CardStatus
  viewerRole: UserRole
  approved: string[]
  submitted: string[]
  unread: Record<string, { count: number; mentions: number }>
  onTab: (i: number) => void
  onCaption: (postId: string, blurb: string) => void
  onApprove: (postId: string) => void
  onSubmit: (postId: string) => void
  onPlanSchedule: () => void
  notes: React.ReactNode
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  disabled?: boolean
  disabledReason?: string
}

export function DraftsCard({
  posts,
  activeIndex,
  status,
  viewerRole,
  approved,
  submitted,
  unread,
  onTab,
  onCaption,
  onApprove,
  onSubmit,
  onPlanSchedule,
  notes,
  error,
  cap,
  disabled,
  disabledReason,
}: DraftsCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.drafts
  const baseId = useId()
  const countId = `${baseId}-count`
  const current = posts[activeIndex] ?? posts[0]
  const isApproved = Boolean(current && approved.includes(current.id))
  const isSubmitted = Boolean(current && submitted.includes(current.id))
  const allApproved = posts.length > 0 && posts.every((p) => approved.includes(p.id))

  const primary = !current
    ? undefined
    : status === "done" || allApproved
      ? { label: c.secondary, onClick: onPlanSchedule }
      : viewerRole === "contributor"
        ? {
            label: isSubmitted ? c.submitted : c.submit,
            onClick: () => onSubmit(current.id),
            disabled: isSubmitted,
            disabledReason: isSubmitted ? c.waitingEditor : undefined,
          }
        : {
            label: isApproved ? c.approved : c.approve,
            icon: Check,
            onClick: () => onApprove(current.id),
            disabled: isApproved,
          }

  const secondary =
    status === "done" || allApproved
      ? undefined
      : { label: c.secondary, onClick: onPlanSchedule }

  return (
    <AgenticCard
      id="drafts"
      meta={copy.canvas.meta.drafts}
      title={c.title}
      status={allApproved && status !== "done" ? "done" : status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming(activeIndex + 1)}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={status === "done" || allApproved ? c.allApproved : undefined}
      primary={status === "ready" || status === "needs_you" || status === "done" ? primary : undefined}
      secondary={status === "ready" || status === "needs_you" ? secondary : undefined}
      figmaName="DraftsCard"
    >
      <Tabs value={String(activeIndex)} onValueChange={(v) => onTab(Number(v))}>
        <TabsList aria-label={c.tabsLabel}>
          {posts.map((post, i) => {
            const postApproved = approved.includes(post.id)
            const u = unread[post.id] ?? { count: 0, mentions: 0 }
            return (
              <TabsTrigger
                key={post.id}
                value={String(i)}
                aria-label={postApproved ? c.tabApproved(i + 1) : c.tab(i + 1)}
                className="gap-1.5"
              >
                <span>{c.tab(i + 1)}</span>
                {postApproved ? <Check className="size-3.5 text-success" aria-hidden /> : null}
                <UnreadDot count={u.count} mentions={u.mentions} />
              </TabsTrigger>
            )
          })}
        </TabsList>

        {posts.map((post, i) => {
          const channel = primaryChannel(post)
          const blurb = post.blurb ?? ""
          return (
            <TabsContent key={post.id} value={String(i)} className="flex flex-col gap-4 pt-3">
              <div className="grid grid-cols-1 gap-4 @xl/card:grid-cols-5">
                <div className="mx-auto w-48 @xl/card:col-span-2 @xl/card:w-full">
                  <PreviewTile
                    size="md"
                    tile={post.tile}
                    alt={copy.cards.directions.tileAlt(post.tile.headline)}
                  />
                </div>
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface-soft/40 p-3.5 @xl/card:col-span-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                    <ChannelMark channel={channel} />
                    <span className="text-caption text-muted-foreground tabular-nums">
                      {formatWhen(post.scheduledDate, post.scheduledTime ?? "09:00")}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${baseId}-caption-${post.id}`}>{c.caption}</Label>
                      <span id={countId} className="text-caption text-muted-foreground tabular-nums">
                        {c.count(blurb.length)}
                      </span>
                    </div>
                    <Textarea
                      id={`${baseId}-caption-${post.id}`}
                      value={blurb}
                      maxLength={2200}
                      aria-describedby={countId}
                      onChange={(e) => onCaption(post.id, e.target.value)}
                      rows={4}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
              {i === activeIndex && notes ? <div className="border-t border-border pt-3">{notes}</div> : null}
            </TabsContent>
          )
        })}
      </Tabs>
    </AgenticCard>
  )
}
