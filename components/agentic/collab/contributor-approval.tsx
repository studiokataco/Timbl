"use client"

import { useEffect, useEffectEvent, useId, useRef, useState } from "react"
import { Controller, useForm, type FieldErrors, type Resolver, type ResolverResult } from "react-hook-form"
import { CircleAlert, CircleCheck, Lock, TriangleAlert, Undo2 } from "lucide-react"
import { postStatusLabel } from "@/lib/labels/enums"
import { REJECT_REASONS, REJECT_REASON_LABELS } from "@/lib/schemas/_shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import { formatRelative, formatWhen } from "../clock"
import { REDUCED_POPUP, sendBackSchema, TONE_DOT, tw } from "../lib"
import type { ApprovalSubmission, PrototypePost, RejectReason, TeamMember, ToneToken } from "../types"

type ContributorApprovalProps = {
  post: PrototypePost
  submission: ApprovalSubmission | null
  viewer: TeamMember
  team: TeamMember[]
  onApprove: () => void
  onSendBack: (reason: RejectReason, note: string) => void
  onWithdraw: () => void
  variant?: "standalone" | "embedded"
  sendBackOpen?: boolean
  formId?: string
  validateOnMount?: boolean
}

type SendBackValues = { reason: RejectReason | null; note: string }
type Mode = "none" | "approver" | "stale" | "self-blocked" | "submitter" | "not-approver" | "approved" | "sent-back" | "approved-by-you"

const sendBackResolver: Resolver<SendBackValues> = async (values): Promise<ResolverResult<SendBackValues>> => {
  const result = sendBackSchema.safeParse(values)
  if (result.success) return { values: { reason: result.data.reason, note: result.data.note }, errors: {} }
  const errors: FieldErrors<SendBackValues> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if ((field === "reason" || field === "note") && !errors[field]) errors[field] = { type: issue.code, message: issue.message }
  }
  return { values: {}, errors }
}

function statusTone(status: string): ToneToken {
  if (status === "needs_approval") return "warning"
  if (status === "scheduled" || status === "posted") return "success"
  return "muted"
}

function deriveMode(post: PrototypePost, submission: ApprovalSubmission | null, viewer: TeamMember): Mode {
  if (!submission) return "none"
  const stale = submission.contentRev < post.contentRev
  if (submission.decision && !stale) return submission.decision.outcome === "approved" ? "approved" : "sent-back"
  const approver = viewer.role !== "contributor"
  const submitter = submission.submittedBy === viewer.id
  if (approver && submitter) return "self-blocked"
  if (approver) {
    if (stale) return "stale"
    const mine = submission.approvals.some((a) => a.by === viewer.id && a.rev === post.contentRev)
    return mine ? "approved-by-you" : "approver"
  }
  return submitter ? "submitter" : "not-approver"
}

function FieldError({ id, message }: { id: string; message: string }): React.JSX.Element {
  return (
    <p id={id} className="text-caption flex gap-1.5 text-foreground">
      <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
      <span>{message}</span>
    </p>
  )
}

export function ContributorApproval({
  post,
  submission,
  viewer,
  team,
  onApprove,
  onSendBack,
  onWithdraw,
  variant = "standalone",
  sendBackOpen = false,
  formId,
  validateOnMount = false,
}: ContributorApprovalProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const uid = useId()
  const [formOpenLocal, setFormOpenLocal] = useState(sendBackOpen)
  const embedded = variant === "embedded"
  const formOpen = embedded ? sendBackOpen : formOpenLocal
  const ownFormId = formId ?? `${uid}-form`
  const reasonId = `${uid}-reason`
  const noteId = `${uid}-note`
  const reasonErrId = `${uid}-reason-err`
  const noteErrId = `${uid}-note-err`
  const blockedId = `${uid}-blocked`

  const {
    control,
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<SendBackValues>({ resolver: sendBackResolver, defaultValues: { reason: null, note: "" }, shouldFocusError: true })

  const focusReason = useRef(false)
  useEffect(() => {
    if (!formOpenLocal || !focusReason.current) return
    focusReason.current = false
    document.getElementById(reasonId)?.focus()
  }, [formOpenLocal, reasonId])

  const validateNow = useEffectEvent(() => {
    if (validateOnMount) void trigger()
  })
  useEffect(() => {
    validateNow()
  }, [])

  const mode = deriveMode(post, submission, viewer)
  const nameOf = (id: string) => (id === viewer.id ? copy.notes.you : (team.find((m) => m.id === id)?.name ?? ""))
  const submitterName = submission ? nameOf(submission.submittedBy) : ""
  const eligible = submission ? team.filter((m) => m.role !== "contributor" && m.id !== submission.submittedBy).length : 0
  const required = submission ? Math.min(submission.requiredApprovers, Math.max(1, eligible)) : 0
  const approvalsNow = submission ? submission.approvals.filter((a) => a.rev === post.contentRev).length : 0
  const canDecide = mode === "approver" || mode === "stale" || mode === "self-blocked"
  const showForm = formOpen && canDecide
  const when = formatWhen(post.scheduledDate, post.scheduledTime ?? "09:00")
  const tone = statusTone(post.status)

  const submit = handleSubmit((values) => {
    if (!values.reason) return
    onSendBack(values.reason, values.note.trim())
    reset()
    setFormOpenLocal(false)
  })

  const closeForm = () => {
    reset()
    setFormOpenLocal(false)
  }

  const dataState = showForm ? (Object.keys(errors).length > 0 ? "send-back-error" : "send-back") : mode

  const reasonError = errors.reason ? copy.approve.reasonRequired : null
  const noteError = errors.note ? copy.approve.noteRequired : null

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      data-slot="agentic-contributor-approval"
      data-state={dataState}
      data-variant={variant}
      data-figma="ContributorApproval"
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4"
    >
      <header data-figma="ContributorApproval/header" className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`${uid}-heading`} className="text-title-sm text-foreground">
            {copy.approve.heading}
          </h3>
          <Badge variant="outline" data-figma="ContributorApproval/badge">
            <span aria-hidden className={tw("size-1.5 rounded-full", TONE_DOT[tone])} />
            {postStatusLabel(post.status)}
          </Badge>
        </div>
        {submission ? (
          <p className="text-caption text-muted-foreground">
            {copy.approve.submittedBy(submitterName, formatRelative(submission.submittedAt))}
            {submission.requiredApprovers > 1 ? ` · ${copy.approve.multi(approvalsNow, required)}` : null}
          </p>
        ) : null}
      </header>

      {mode === "approved" && submission?.decision ? (
        <p className="text-body-sm flex items-start gap-2 text-foreground">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{copy.approve.approvedLine(nameOf(submission.decision.by), formatRelative(submission.decision.at))}</span>
        </p>
      ) : null}

      {mode === "approved-by-you" && submission ? (
        <p className="text-body-sm flex items-start gap-2 text-foreground">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{copy.approve.approvedLine(copy.notes.you, formatRelative(submission.approvals.find((a) => a.by === viewer.id)?.at ?? submission.submittedAt))}</span>
        </p>
      ) : null}

      {mode === "sent-back" && submission?.decision ? (
        <div className="flex flex-col gap-1">
          <p className="text-body-sm flex items-start gap-2 text-foreground">
            <Undo2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              {copy.approve.sentBackLine(
                nameOf(submission.decision.by),
                submission.decision.reason ? REJECT_REASON_LABELS[submission.decision.reason] : "",
              )}
            </span>
          </p>
          {submission.decision.note ? <p className="text-body-sm pl-6 text-muted-foreground">{submission.decision.note}</p> : null}
        </div>
      ) : null}

      {mode === "stale" ? (
        <p className="text-body-sm flex items-start gap-2 text-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{copy.approve.stale}</span>
        </p>
      ) : null}

      {mode === "self-blocked" ? (
        <p id={blockedId} className="text-caption flex items-start gap-1.5 text-muted-foreground">
          <Lock aria-hidden className="size-4 shrink-0" />
          <span>{copy.approve.selfBlocked}</span>
        </p>
      ) : null}

      {mode === "submitter" ? <p className="text-body-sm text-muted-foreground">{copy.approve.waiting}</p> : null}
      {mode === "not-approver" ? <p className="text-body-sm text-muted-foreground">{copy.approve.notApprover}</p> : null}

      {canDecide ? <p className="text-caption text-muted-foreground">{copy.approve.schedulesFor(when)}</p> : null}

      {showForm ? (
        <form id={ownFormId} noValidate onSubmit={submit} data-figma="ContributorApproval/form" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={reasonId}>{copy.approve.reason}</Label>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Select
                  items={REJECT_REASON_LABELS}
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as RejectReason | null)}
                >
                  <SelectTrigger
                    ref={field.ref}
                    id={reasonId}
                    onBlur={field.onBlur}
                    aria-invalid={reasonError ? true : undefined}
                    aria-describedby={reasonError ? reasonErrId : undefined}
                    className="w-full"
                  >
                    <SelectValue placeholder={copy.approve.reasonPlaceholder} />
                  </SelectTrigger>
                  <SelectContent className={reduced ? REDUCED_POPUP : undefined}>
                    {REJECT_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {REJECT_REASON_LABELS[reason]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {reasonError ? <FieldError id={reasonErrId} message={reasonError} /> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId}>{copy.approve.noteLabel(submitterName)}</Label>
            <Textarea
              id={noteId}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteError ? noteErrId : undefined}
              className="max-h-40"
              {...register("note")}
            />
            {noteError ? <FieldError id={noteErrId} message={noteError} /> : null}
          </div>
          {!embedded ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" data-figma="ContributorApproval/primary">
                {copy.approve.confirmSendBack}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm} data-figma="ContributorApproval/secondary">
                {copy.approve.cancel}
              </Button>
            </div>
          ) : null}
        </form>
      ) : null}

      {!embedded && !showForm && canDecide ? (
        <div className="flex flex-wrap items-center gap-2">
          {mode === "self-blocked" ? (
            <Button
              disabled
              focusableWhenDisabled
              aria-describedby={blockedId}
              className="aria-disabled:opacity-50"
              data-figma="ContributorApproval/primary"
            >
              {copy.approve.approve}
            </Button>
          ) : (
            <Button onClick={onApprove} data-figma="ContributorApproval/primary">
              {copy.approve.approve}
            </Button>
          )}
          <Button variant="outline" onClick={() => {
              focusReason.current = true
              setFormOpenLocal(true)
            }} data-figma="ContributorApproval/secondary">
            {copy.approve.sendBack}
          </Button>
        </div>
      ) : null}

      {!embedded && mode === "submitter" ? (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onWithdraw} data-figma="ContributorApproval/secondary">
            {copy.approve.withdraw}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
