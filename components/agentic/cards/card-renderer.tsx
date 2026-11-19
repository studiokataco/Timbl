"use client"

import { useId, useState } from "react"
import { postStatusLabel } from "@/lib/labels/enums"
import { ApprovalsQueueCard, type ApprovalsQueueItemRow } from "./approvals-queue-card"
import { BriefCard } from "./brief-card"
import { CurrentItemCard } from "./current-item-card"
import { DirectionsCard } from "./directions-card"
import { DraftsCard } from "./drafts-card"
import { HandoffCard } from "./handoff-card"
import { RecommendationCard } from "./recommendation-card"
import { ScheduleCard } from "./schedule-card"
import { ContributorApproval } from "../collab/contributor-approval"
import { NoteThread } from "../collab/note-thread"
import { AssistantAvatar } from "../primitives/presence-orb"
import { deriveQueue } from "../engine/reducer"
import { useEngine } from "../engine/engine-context"
import { unreadFor } from "../lib"
import { usePrototype } from "../prototype-context"

export function CanvasCardRenderer({ onGoToApproval }: { onGoToApproval?: () => void }): React.JSX.Element | null {
  const { state, dispatch } = useEngine()
  const { viewer, role, copy, team } = usePrototype()
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const sendBackFormId = useId()
  const card = state.canvas.card
  const status = state.canvas.status
  if (!card) return null

  const disabledWorking = state.run?.status === "running" && status !== "streaming"
  const commonStatus = {
    disabled: disabledWorking,
    disabledReason: disabledWorking ? copy.cards.shell.disabledWorking : undefined,
    error:
      status === "error"
        ? {
            title: copy.cards.shell.errorTitle,
            body: state.run?.steps.find((s) => s.state === "failed")?.error ?? copy.cards.shell.errorBody,
            onRetry: () => dispatch({ type: "retry" }),
            onEdit: () => dispatch({ type: "run_revise" }),
          }
        : undefined,
  }

  if (card.kind === "directions") {
    const ideas = Object.values(state.ideas)
    const slice = card.set === "more" ? ideas.slice(3, 6) : ideas.slice(0, 3)
    return (
      <DirectionsCard
        ideas={slice.length ? slice : ideas}
        selectedId={card.selectedId}
        status={status}
        onSelect={(ideaId) => dispatch({ type: "card_action", action: { card: "directions", kind: "select", ideaId } })}
        onBuild={() => dispatch({ type: "card_action", action: { card: "directions", kind: "build" } })}
        onCompare={() => dispatch({ type: "card_action", action: { card: "directions", kind: "compare" } })}
        {...commonStatus}
      />
    )
  }

  if (card.kind === "recommendation") {
    const ideas = Object.values(state.ideas)
    const idea = state.ideas[card.ideaId] ?? ideas[0]
    const alt = state.ideas[card.alternateId] ?? ideas[1] ?? idea
    if (!idea || !alt) return null
    return (
      <RecommendationCard
        idea={idea}
        alternate={alt}
        status={status}
        onUse={() => dispatch({ type: "card_action", action: { card: "recommendation", kind: "use" } })}
        onKeepExploring={() => dispatch({ type: "card_action", action: { card: "recommendation", kind: "keep_exploring" } })}
        {...commonStatus}
      />
    )
  }

  if (card.kind === "brief") {
    return (
      <BriefCard
        brief={state.brief}
        status={status}
        onEdit={(patch) => dispatch({ type: "card_action", action: { card: "brief", kind: "edit", patch } })}
        onCreate={() => dispatch({ type: "card_action", action: { card: "brief", kind: "create" } })}
        onDebate={() => dispatch({ type: "card_action", action: { card: "brief", kind: "debate" } })}
        {...commonStatus}
      />
    )
  }

  if (card.kind === "drafts") {
    const draftPosts = Object.values(state.posts).filter(
      (p) => p.status !== "archived" && p.status !== "posted",
    )
    const unread: Record<string, { count: number; mentions: number }> = {}
    for (const p of draftPosts) {
      unread[p.id] = unreadFor(state.notes, state.reads, p.id, viewer.id)
    }
    const activePost = draftPosts[card.activeIndex] ?? draftPosts[0]
    const activeNotes = activePost ? state.notes.filter((n) => n.postId === activePost.id) : []
    const lastRead = activePost
      ? state.reads.find((r) => r.postId === activePost.id && r.userId === viewer.id)?.lastReadAt
      : undefined

    return (
      <DraftsCard
        posts={draftPosts}
        activeIndex={card.activeIndex}
        status={status}
        viewerRole={role}
        approved={state.drafts.approved}
        submitted={state.drafts.submitted}
        unread={unread}
        onTab={(index) => dispatch({ type: "card_action", action: { card: "drafts", kind: "tab", index } })}
        onCaption={(postId, blurb) => dispatch({ type: "caption_edited", postId, blurb })}
        onApprove={(postId) => dispatch({ type: "card_action", action: { card: "drafts", kind: "approve", postId } })}
        onSubmit={(postId) => dispatch({ type: "card_action", action: { card: "drafts", kind: "submit", postId } })}
        onPlanSchedule={() => dispatch({ type: "card_action", action: { card: "drafts", kind: "plan_schedule" } })}
        notes={
          activePost ? (
            <NoteThread
              post={activePost}
              notes={activeNotes}
              team={team}
              viewerId={viewer.id}
              lastReadAt={lastRead}
              density="card"
              embedded
              assistantAvatar={<AssistantAvatar />}
              onAdd={(body) => dispatch({ type: "note_added", postId: activePost.id, body })}
              onEdit={(noteId, body) => dispatch({ type: "note_edited", noteId, body })}
              onDelete={(noteId) => dispatch({ type: "note_deleted", noteId })}
              onReact={(noteId, emoji) => dispatch({ type: "note_reacted", noteId, emoji })}
              onRead={() => dispatch({ type: "thread_read", postId: activePost.id })}
            />
          ) : null
        }
        {...commonStatus}
      />
    )
  }

  if (card.kind === "schedule") {
    const pending = state.requests.some((r) => r.status === "pending")
    return (
      <ScheduleCard
        slots={state.schedule}
        posts={state.posts}
        status={pending ? "needs_you" : status}
        onEditSlot={(index, patch) => dispatch({ type: "card_action", action: { card: "schedule", kind: "edit_slot", index, patch } })}
        onConfirm={() => dispatch({ type: "card_action", action: { card: "schedule", kind: "confirm" } })}
        onCadence={() => dispatch({ type: "card_action", action: { card: "schedule", kind: "cadence" } })}
        onGoToApproval={onGoToApproval}
        {...commonStatus}
      />
    )
  }

  if (card.kind === "handoff") {
    const reviewers = team.filter((m) => (m.role === "admin" || m.role === "editor") && m.id !== viewer.id)
    return (
      <HandoffCard
        slotCount={state.staged.length || 3}
        reviewers={reviewers}
        viewerRole={role}
        onOpenCalendar={() => dispatch({ type: "card_action", action: { card: "handoff", kind: "open_calendar" } })}
        onReview={() => dispatch({ type: "card_action", action: { card: "handoff", kind: "review" } })}
        status={status}
        {...commonStatus}
      />
    )
  }

  if (card.kind === "approvals_queue") {
    const queue = deriveQueue(state, viewer)
    const rows: ApprovalsQueueItemRow[] = queue.map((q) => {
      const item = q.item
      if (item.source === "guardrail") {
        const req = state.requests.find((r) => r.id === item.requestId)
        const verb = req ? copy.approval.verbs.schedule(req.postIds.length) : "Schedule"
        return {
          item,
          title: verb,
          line: copy.cards.queue.guardrailRow(verb),
          badge: copy.approval.meta,
          unread: { count: 0, mentions: 0 },
          needsViewer: q.needsViewer,
        }
      }
      const post = state.posts[item.postId]
      const sub = state.submissions.find((s) => s.postId === item.postId)
        const who = team.find((m) => m.id === sub?.submittedBy)?.name ?? "Contributor"
      return {
        item,
        title: post?.brief ?? item.postId,
        line: item.source === "contributor" ? copy.cards.queue.contributorRow(who) : copy.cards.queue.agentRow,
        badge: post ? postStatusLabel(post.status) : copy.approve.status,
        unread: unreadFor(state.notes, state.reads, item.postId, viewer.id),
        needsViewer: q.needsViewer,
      }
    })

    return (
      <ApprovalsQueueCard
        items={rows}
        status={status}
        viewerRole={role}
        onOpenItem={(itemId) => dispatch({ type: "card_action", action: { card: "approvals_queue", kind: "open_item", itemId } })}
        onReviewNext={() => dispatch({ type: "card_action", action: { card: "approvals_queue", kind: "review_next" } })}
        onOpenActivity={() => dispatch({ type: "card_action", action: { card: "approvals_queue", kind: "open_activity" } })}
        {...commonStatus}
      />
    )
  }

  const post = state.posts[card.postId] ?? Object.values(state.posts)[0]
  if (!post) return null
  const owner = team.find((m) => m.id === post.leadUserId) ?? viewer
  const submission = state.submissions.find((s) => s.postId === post.id) ?? null
  const queueMatch = deriveQueue(state, viewer).find(
    (q) => q.item.source !== "guardrail" && q.item.postId === post.id,
  )
  const needsViewer = Boolean(queueMatch?.needsViewer)
  const postNotes = state.notes.filter((n) => n.postId === post.id)
  const lastRead = state.reads.find((r) => r.postId === post.id && r.userId === viewer.id)?.lastReadAt

  return (
    <CurrentItemCard
      post={post}
      origin={card.origin}
      owner={owner}
      status={status}
      needsViewer={needsViewer}
      onApply={(blurb) => dispatch({ type: "card_action", action: { card: "current_item", kind: "apply_edit", blurb } })}
      onOpenEditor={() => dispatch({ type: "card_action", action: { card: "current_item", kind: "open_editor" } })}
      onApprove={() => dispatch({ type: "submission_decided", postId: post.id, outcome: "approved" })}
      sendBackOpen={sendBackOpen}
      onSendBackOpenChange={setSendBackOpen}
      sendBackFormId={sendBackFormId}
      approval={
        submission ? (
          <ContributorApproval
            post={post}
            submission={submission}
            viewer={viewer}
            team={team}
            variant="embedded"
            sendBackOpen={sendBackOpen}
            formId={sendBackFormId}
            onApprove={() => dispatch({ type: "submission_decided", postId: post.id, outcome: "approved" })}
            onSendBack={(reason, note) => {
              dispatch({ type: "submission_decided", postId: post.id, outcome: "sent_back", reason, note })
              setSendBackOpen(false)
            }}
            onWithdraw={() => dispatch({ type: "submission_withdrawn", postId: post.id })}
          />
        ) : null
      }
      notes={
        <NoteThread
          post={post}
          notes={postNotes}
          team={team}
          viewerId={viewer.id}
          lastReadAt={lastRead}
          density="card"
          embedded
          assistantAvatar={<AssistantAvatar />}
          onAdd={(body) => dispatch({ type: "note_added", postId: post.id, body })}
          onEdit={(noteId, body) => dispatch({ type: "note_edited", noteId, body })}
          onDelete={(noteId) => dispatch({ type: "note_deleted", noteId })}
          onReact={(noteId, emoji) => dispatch({ type: "note_reacted", noteId, emoji })}
          onRead={() => dispatch({ type: "thread_read", postId: post.id })}
        />
      }
      {...commonStatus}
    />
  )
}

export const CardRenderer = CanvasCardRenderer
