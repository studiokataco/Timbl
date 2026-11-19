"use client"

import { ArrowUpRight, CalendarCheck, Lock, Users } from "lucide-react"
import { AvatarGroup } from "@/components/ui/avatar"
import { PersonAvatar } from "../collab/person-avatar"
import { AgenticCard, type AgenticCardProps } from "../primitives/agentic-card"
import { usePrototype } from "../prototype-context"
import type { CardStatus, TeamMember, UserRole } from "../types"

export type HandoffCardProps = {
  slotCount: number
  reviewers: TeamMember[]
  viewerRole: UserRole
  onOpenCalendar: () => void
  onReview: () => void
  status: CardStatus
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  disabled?: boolean
  disabledReason?: string
}

export function HandoffCard({
  slotCount,
  reviewers,
  viewerRole,
  onOpenCalendar,
  onReview,
  status,
  error,
  cap,
  disabled,
  disabledReason,
}: HandoffCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.handoff
  const rA = reviewers[0]?.name ?? "Workspace admin"
  const rB = reviewers[1]?.name ?? "Content lead"

  return (
    <AgenticCard
      id="handoff"
      meta={copy.canvas.meta.handoff}
      title={c.title}
      status={status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={status === "done" ? c.done : undefined}
      primary={status === "ready" || status === "needs_you" ? { label: c.primary, icon: ArrowUpRight, onClick: onOpenCalendar } : undefined}
      secondary={status === "ready" || status === "needs_you" ? { label: c.secondary, onClick: onReview } : undefined}
      figmaName="HandoffCard"
    >
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface-soft/40">
        <li className="flex items-center gap-3 px-3.5 py-3">
          <CalendarCheck className="size-4 shrink-0 text-success" aria-hidden />
          <span className="text-body-sm font-medium text-foreground">{c.staged(slotCount)}</span>
        </li>
        <li className="flex items-center justify-between gap-3 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-body-sm text-foreground">{c.reviewers(rA, rB)}</span>
          </div>
          <AvatarGroup aria-hidden="true">
            {reviewers.slice(0, 3).map((member) => (
              <PersonAvatar key={member.id} member={member} size="sm" />
            ))}
          </AvatarGroup>
        </li>
        <li className="flex items-center gap-3 px-3.5 py-3">
          <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-body-sm text-muted-foreground">
            {viewerRole === "contributor" ? c.contributorLine : c.locked}
          </span>
        </li>
      </ul>
    </AgenticCard>
  )
}
