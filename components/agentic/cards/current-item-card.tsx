"use client"

import { useState } from "react"
import { CHANNEL_LABELS, postStatusLabel } from "@/lib/labels/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatWhen } from "../clock"
import { primaryChannel } from "../lib"
import { AgenticCard, type AgenticCardProps, type CardCta } from "../primitives/agentic-card"
import { PreviewTile } from "../primitives/preview-tile"
import { usePrototype } from "../prototype-context"
import type { CardStatus, PrototypePost, TeamMember } from "../types"

export type CurrentItemCardProps = {
  post: PrototypePost
  origin: "handoff" | "queue" | "context"
  owner: TeamMember
  status: CardStatus
  needsViewer: boolean
  editingBy?: TeamMember
  onApply: (blurb: string) => void
  onOpenEditor: () => void
  onApprove: () => void
  sendBackOpen: boolean
  onSendBackOpenChange: (open: boolean) => void
  sendBackFormId: string
  approval: React.ReactNode
  notes: React.ReactNode
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  disabled?: boolean
  disabledReason?: string
}

export function CurrentItemCard({
  post,
  origin,
  owner,
  status,
  needsViewer,
  editingBy,
  onApply,
  onOpenEditor,
  onApprove,
  sendBackOpen,
  onSendBackOpenChange,
  sendBackFormId,
  approval,
  notes,
  error,
  cap,
  disabled,
  disabledReason,
}: CurrentItemCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.current
  const [draft, setDraft] = useState<string | null>(null)
  const currentText = draft ?? post.blurb ?? ""
  const isDirty = draft !== null && draft !== (post.blurb ?? "")
  const channel = primaryChannel(post)

  const postTitle = post.brief ?? "Untitled post"
  const postWhen = formatWhen(post.scheduledDate, post.scheduledTime ?? "09:00")
  const meta =
    origin === "handoff"
      ? c.meta.handoff(postTitle)
      : origin === "queue"
        ? c.meta.queue(postTitle)
        : c.meta.context(postTitle)

  let primary: CardCta | undefined
  let secondary: CardCta | undefined

  if (status === "ready" || status === "needs_you") {
    if (isDirty) {
      primary = {
        label: c.primary,
        onClick: () => {
          onApply(currentText)
          setDraft(null)
        },
      }
      secondary = {
        label: c.discard,
        onClick: () => setDraft(null),
      }
    } else if (needsViewer && !sendBackOpen) {
      primary = {
        label: copy.approve.approve,
        onClick: onApprove,
      }
      secondary = {
        label: copy.approve.sendBack,
        onClick: () => onSendBackOpenChange(true),
      }
    } else if (needsViewer && sendBackOpen) {
      primary = undefined
      secondary = undefined
    } else {
      primary = {
        label: c.primary,
        onClick: () => onApply(currentText),
        disabled: true,
        disabledReason: c.applyFirst,
      }
      secondary = {
        label: c.secondary,
        onClick: onOpenEditor,
      }
    }
  }

  return (
    <AgenticCard
      id="current"
      meta={meta}
      title={postTitle}
      status={status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={status === "done" ? c.done : undefined}
      primary={primary}
      secondary={secondary}
      figmaName="CurrentItemCard"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-caption text-muted-foreground">
            {c.origin[origin]} · {c.context(CHANNEL_LABELS[channel], owner.name, postWhen)}
          </span>
          <Badge variant="outline">{postStatusLabel(post.status)}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 @xl/card:grid-cols-5">
          <div className="mx-auto w-48 @xl/card:col-span-2 @xl/card:w-full">
            <PreviewTile
              size="md"
              tile={post.tile}
              alt={copy.cards.directions.tileAlt(post.tile.headline)}
            />
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-soft/40 p-3.5 @xl/card:col-span-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <Label htmlFor={`current-caption-${post.id}`}>{copy.cards.drafts.caption}</Label>
              <span className="text-caption text-muted-foreground tabular-nums">
                {copy.cards.drafts.count(currentText.length)}
              </span>
            </div>
            <Textarea
              id={`current-caption-${post.id}`}
              value={currentText}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="bg-background"
            />
            {isDirty && needsViewer ? (
              <p className="text-caption text-muted-foreground">{c.applyFirst}</p>
            ) : null}
            {editingBy ? (
              <p className="text-caption font-medium text-foreground">{c.editing(editingBy.name)}</p>
            ) : null}
          </div>
        </div>

        {approval}
        {needsViewer && sendBackOpen ? (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              data-cta="secondary"
              onClick={() => onSendBackOpenChange(false)}
            >
              {copy.approve.cancel}
            </Button>
            <Button type="submit" form={sendBackFormId} data-cta="primary">
              {copy.approve.confirmSendBack}
            </Button>
          </div>
        ) : null}
        {notes ? <div className="border-t border-border pt-3">{notes}</div> : null}
      </div>
    </AgenticCard>
  )
}
