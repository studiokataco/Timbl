"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UnreadDot } from "../collab/unread-dot"
import { AgenticCard, type AgenticCardProps } from "../primitives/agentic-card"
import { usePrototype } from "../prototype-context"
import type { ApprovalQueueItem, CardStatus, UserRole } from "../types"

export type ApprovalsQueueItemRow = {
  item: ApprovalQueueItem
  title: string
  line: string
  badge: string
  unread: { count: number; mentions: number }
  needsViewer: boolean
}

export type ApprovalsQueueCardProps = {
  items: ApprovalsQueueItemRow[]
  status: CardStatus
  viewerRole: UserRole
  onOpenItem: (id: string) => void
  onReviewNext: () => void
  onOpenActivity: () => void
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  disabled?: boolean
  disabledReason?: string
}

export function ApprovalsQueueCard({
  items,
  status,
  viewerRole,
  onOpenItem,
  onReviewNext,
  onOpenActivity,
  error,
  cap,
  disabled,
  disabledReason,
}: ApprovalsQueueCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.queue
  const needsCount = items.filter((i) => i.needsViewer).length
  const isContributor = viewerRole === "contributor"

  return (
    <AgenticCard
      id="queue"
      meta={copy.canvas.meta.approvals}
      title={c.title}
      status={items.length === 0 ? "empty" : status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={status === "done" ? c.done : undefined}
      primary={
        items.length > 0 && (status === "ready" || status === "needs_you")
          ? {
              label: c.primary,
              onClick: onReviewNext,
              disabled: isContributor || needsCount === 0,
              disabledReason: isContributor ? copy.approve.notApprover : undefined,
            }
          : undefined
      }
      secondary={
        status === "ready" || status === "needs_you" || status === "empty"
          ? { label: c.secondary, onClick: onOpenActivity }
          : undefined
      }
      figmaName="ApprovalsQueueCard"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{c.count(needsCount)}</Badge>
          {isContributor ? <span className="text-caption text-muted-foreground">{c.contributorNote}</span> : null}
        </div>
        <ul className="flex flex-col gap-1">
          {items.map((row) => (
            <li key={row.item.id}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenItem(row.item.id)}
                data-figma={`ApprovalsQueueCard/${row.item.id}`}
                className="h-auto w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left"
              >
                <span className="flex min-w-0 items-start gap-2.5">
                  <UnreadDot count={row.unread.count} mentions={row.unread.mentions} className="mt-1.5" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-sm font-medium text-foreground">{row.title}</span>
                    <span className="truncate text-caption text-muted-foreground">{row.line}</span>
                  </span>
                </span>
                <Badge variant="outline">{row.badge}</Badge>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </AgenticCard>
  )
}
