"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useForm, type FieldErrors, type Resolver } from "react-hook-form"
import { CircleAlert, Clock, Lock, MessageSquareText, Send, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatRelative, formatWhen } from "../clock"
import { primaryChannel, requestChangesSchema } from "../lib"
import { ChannelMark } from "./channel-mark"
import { usePrototype } from "../prototype-context"
import type { GuardrailRequest, PrototypePost, UserRole } from "../types"
import { AgenticCard, type AgenticCardProps } from "./agentic-card"

type ApprovalCardProps = {
  request: GuardrailRequest
  posts: PrototypePost[]
  viewerRole: UserRole
  onApprove: () => void
  onRequestChanges: (feedback: string) => void
  onSubmit: () => void
  onUndo?: () => void
  compact?: boolean
  headingRef?: React.Ref<HTMLHeadingElement>
  initialMode?: "form" | "form-error" | "approving"
}

type FeedbackValues = { feedback: string }

const APPROVING_MS = 400
const WHEN_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/

function whenLabel(when: string | undefined, posts: PrototypePost[]): string {
  const match = when?.match(WHEN_PATTERN)
  if (match) return formatWhen(match[1], match[2])
  if (when) return when
  const post = posts[0]
  return post ? formatWhen(post.scheduledDate, post.scheduledTime ?? "09:00") : ""
}

export function ApprovalCard({
  request,
  posts,
  viewerRole,
  onApprove,
  onRequestChanges,
  onSubmit,
  onUndo,
  compact = false,
  headingRef,
  initialMode,
}: ApprovalCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const a = copy.approval
  const [formOpen, setFormOpen] = useState(initialMode === "form" || initialMode === "form-error")
  const [approving, setApproving] = useState(initialMode === "approving")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaId = useId()
  const errorId = useId()

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const resolver = useMemo<Resolver<FeedbackValues>>(
    () => (values) => {
      const parsed = requestChangesSchema.safeParse(values)
      if (parsed.success) return { values: parsed.data, errors: {} }
      const errors: FieldErrors<FeedbackValues> = { feedback: { type: "required", message: a.feedbackRequired } }
      return { values: {}, errors }
    },
    [a.feedbackRequired],
  )
  const form = useForm<FeedbackValues>({ defaultValues: { feedback: "" }, resolver, shouldFocusError: true })
  const { errors, submitCount, isDirty } = form.formState
  const seededError = initialMode === "form-error" && submitCount === 0 && !isDirty
  const feedbackError = Boolean(errors.feedback) || seededError

  const count = request.postIds.length
  const when = whenLabel(request.when, posts)
  const named = posts[0]?.brief || posts[0]?.blurb
  const verb =
    request.action === "schedule" && when
      ? a.verbs.scheduleNamed(when)
      : request.action === "reschedule"
        ? a.verbs.reschedule(when)
        : request.action === "delete" && named
          ? a.verbs.deleteNamed(named)
          : request.action === "publish" && named
            ? a.verbs.publishNamed(named)
            : a.verbs[request.action](count)

  function approve() {
    setApproving(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setApproving(false)
      onApprove()
    }, APPROVING_MS)
  }

  function closeForm() {
    form.reset({ feedback: "" })
    setFormOpen(false)
  }

  const sendFeedback = form.handleSubmit((values) => {
    onRequestChanges(values.feedback)
    closeForm()
  })

  const base: AgenticCardProps = {
    id: `approval-${request.id}`,
    meta: a.meta,
    metaIcon: ShieldCheck,
    title: verb,
    headingLevel: compact ? 3 : 2,
    headingRef,
    figmaName: "ApprovalCard",
    size: compact ? "sm" : "default",
    footnote: { icon: Lock, text: a.guardrail },
  }

  const postList = <PostList posts={posts} max={compact ? 2 : 5} />
  const mode = cardMode()

  function cardMode(): string {
    if (request.status !== "pending") return request.status
    if (viewerRole === "contributor") return "contributor"
    if (approving) return "approving"
    if (formOpen) return "form"
    return "pending"
  }

  function render(): React.JSX.Element {
    switch (request.status) {
      case "approved":
        return (
          <AgenticCard
            {...base}
            status="done"
            summary={a.approved(request.resolvedAt ? formatRelative(request.resolvedAt) : whenLabel(request.when, posts))}
            summaryAction={
              onUndo ? (
                <Button variant="ghost" size="sm" data-cta="secondary" data-figma="ApprovalCard/undo" onClick={onUndo}>
                  {a.undoInline}
                </Button>
              ) : null
            }
          >
            {postList}
          </AgenticCard>
        )
      case "changes_requested":
        return (
          <AgenticCard {...base} status="done" summary={a.changes(request.feedback ?? "")} summaryIcon={MessageSquareText}>
            {postList}
          </AgenticCard>
        )
      case "submitted":
        return (
          <AgenticCard {...base} status="done" summary={a.submitted} summaryIcon={Send}>
            {postList}
          </AgenticCard>
        )
      case "expired":
        return (
          <AgenticCard {...base} status="done" summary={a.expired} summaryIcon={Clock}>
            {postList}
          </AgenticCard>
        )
    }

    if (viewerRole === "contributor") {
      return (
        <AgenticCard {...base} primary={{ label: a.contributorPrimary, onClick: onSubmit }}>
          {postList}
          <p className="text-caption text-muted-foreground">{a.contributorNote}</p>
        </AgenticCard>
      )
    }

    if (formOpen) {
      return (
        <AgenticCard
          {...base}
          primary={{ label: a.sendFeedback, onClick: () => void sendFeedback() }}
          secondary={{ label: a.cancel, onClick: closeForm }}
        >
          {postList}
          <form noValidate onSubmit={sendFeedback} data-figma="ApprovalCard/form" className="flex flex-col gap-2">
            <Label htmlFor={textareaId}>{a.feedbackLabel}</Label>
            <Textarea
              id={textareaId}
              aria-invalid={feedbackError ? true : undefined}
              aria-describedby={feedbackError ? errorId : undefined}
              className="max-h-40"
              {...form.register("feedback")}
            />
            {feedbackError ? (
              <p id={errorId} className="flex gap-1.5 text-caption text-foreground">
                <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
                {a.feedbackRequired}
              </p>
            ) : null}
          </form>
        </AgenticCard>
      )
    }

    return (
      <AgenticCard
        {...base}
        primary={{ label: a.actions[request.action], onClick: approve, busy: approving, busyLabel: a.actions[request.action] }}
        secondary={{ label: a.secondary, onClick: () => setFormOpen(true), disabled: approving }}
      >
        {postList}
      </AgenticCard>
    )
  }

  return (
    <div data-slot="agentic-approval-card" data-state={mode} data-figma="ApprovalCard/frame" className="w-full">
      {render()}
    </div>
  )
}

function PostList({ posts, max }: { posts: PrototypePost[]; max: number }): React.JSX.Element {
  const { copy } = usePrototype()
  const shown = posts.slice(0, max)
  const rest = posts.length - shown.length
  return (
    <ul data-figma="ApprovalCard/posts" className="flex flex-col gap-2">
      {shown.map((post) => {
        const channel = primaryChannel(post)
        return (
          <li key={post.id} className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-sm text-pretty text-foreground">{post.brief}</span>
              <span className="text-caption text-muted-foreground">{formatWhen(post.scheduledDate, post.scheduledTime ?? "09:00")}</span>
            </div>
            <ChannelMark channel={channel} />
          </li>
        )
      })}
      {rest > 0 ? <li className="text-caption text-muted-foreground">{copy.approval.more(rest)}</li> : null}
    </ul>
  )
}
