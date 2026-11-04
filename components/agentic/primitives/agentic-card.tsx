"use client"

import { useEffect, useId, useRef } from "react"
import { CircleAlert, CircleCheck, Inbox, LoaderCircle, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DisclosureTrigger } from "@/components/ui/disclosure"
import { Skeleton } from "@/components/ui/skeleton"
import { TOUCH, tw } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { CardStatus } from "../types"

export type CardCta = {
  label: string
  onClick: () => void
  icon?: LucideIcon
  disabled?: boolean
  disabledReason?: string
  busy?: boolean
  busyLabel?: string
}

export type AgenticCardProps = {
  id: string
  meta: string
  title: string
  status?: CardStatus
  disabled?: boolean
  disabledReason?: string
  primary?: CardCta
  secondary?: CardCta
  footnote?: { icon?: LucideIcon; text: string }
  summary?: string
  empty?: { title: string; body?: string }
  error?: { title: string; body: string; onRetry: () => void; onEdit: () => void }
  cap?: { onSeePlans: () => void; onLater: () => void }
  streamingLabel?: string
  headingLevel?: 2 | 3
  density?: "touch" | "pointer"
  detailsKey?: string
  children?: React.ReactNode
  metaIcon?: LucideIcon
  headingRef?: React.Ref<HTMLHeadingElement>
  figmaName?: string
  size?: "default" | "sm"
  detailsLabels?: { show: string; hide: string }
  summaryIcon?: LucideIcon
  summaryAction?: React.ReactNode
  errorChildren?: React.ReactNode
}

type ResolvedCta = CardCta & { kind: "primary" | "secondary"; variant: "default" | "outline" | "ghost" }

const FOCUSABLES = "a[href], button:not([disabled]), input, select, textarea, [tabindex='0']"

export function AgenticCard({
  id,
  meta,
  title,
  status = "ready",
  disabled = false,
  disabledReason,
  primary,
  secondary,
  footnote,
  summary,
  empty,
  error,
  cap,
  streamingLabel,
  headingLevel = 2,
  density = "pointer",
  detailsKey,
  children,
  metaIcon: MetaIcon,
  headingRef,
  figmaName = "AgenticCard",
  size = "default",
  detailsLabels,
  summaryIcon: SummaryIcon,
  summaryAction,
  errorChildren,
}: AgenticCardProps): React.JSX.Element {
  const { copy, disclosure, setDisclosure } = usePrototype()
  const { reduced } = useAgenticMotion()
  const titleId = useId()
  const reasonId = useId()
  const footnoteId = useId()
  const detailsId = useId()
  const detailsRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)
  const shell = copy.cards.shell
  const key = detailsKey ?? `card:${id}:details`
  const detailsOpen = disclosure[key] ?? false

  useEffect(() => {
    if (!detailsOpen || !pendingFocus.current) return
    pendingFocus.current = false
    const region = detailsRef.current
    if (!region) return
    const first = region.querySelector<HTMLElement>(FOCUSABLES)
    ;(first ?? region).focus()
  }, [detailsOpen])

  const streaming = status === "streaming"
  const ctas = resolveCtas()
  const footerOrder = [...ctas.filter((cta) => cta.kind === "secondary"), ...ctas.filter((cta) => cta.kind === "primary")]
  const reason = ctas.find((cta) => cta.disabled && cta.disabledReason)?.disabledReason
  const Heading = headingLevel === 3 ? "h3" : "h2"

  function resolveCtas(): ResolvedCta[] {
    if (cap) {
      return [
        { kind: "primary", variant: "default", label: shell.seePlans, onClick: cap.onSeePlans },
        { kind: "secondary", variant: "ghost", label: shell.remindLater, onClick: cap.onLater },
      ]
    }
    if (status === "error" && error) {
      return [
        { kind: "primary", variant: "default", label: shell.retry, onClick: error.onRetry },
        { kind: "secondary", variant: "outline", label: shell.editRequest, onClick: error.onEdit },
      ]
    }
    const list: ResolvedCta[] = []
    if (primary) list.push({ ...primary, kind: "primary", variant: "default" })
    if (secondary && status !== "cap_reached") list.push({ ...secondary, kind: "secondary", variant: "outline" })
    return list.map((cta) => {
      if (streaming) return { ...cta, disabled: true, disabledReason: undefined }
      if (status === "cap_reached" && cta.kind === "primary") return { ...cta, disabled: true, disabledReason: shell.capReason }
      if (disabled) return { ...cta, disabled: true, disabledReason: disabledReason ?? cta.disabledReason }
      return cta
    })
  }

  function toggleDetails(open: boolean) {
    pendingFocus.current = open
    setDisclosure(key, open)
  }

  function renderBody(): React.ReactNode {
    switch (status) {
      case "streaming":
        return (
          <div data-figma={`${figmaName}/skeleton`} className="flex flex-col gap-2" aria-hidden>
            <Skeleton className={tw("timbl-mesh h-4 w-full animate-none", !reduced && "timbl-mesh-live")} data-mesh="bloom" />
            <Skeleton className={tw("timbl-mesh h-4 w-5/6 animate-none", !reduced && "timbl-mesh-live")} data-mesh="tide" style={{ "--mesh-delay": "-5s" } as React.CSSProperties} />
            <Skeleton className={tw("timbl-mesh h-4 w-2/3 animate-none", !reduced && "timbl-mesh-live")} data-mesh="mint" style={{ "--mesh-delay": "-9s" } as React.CSSProperties} />
          </div>
        )
      case "error":
        return (
          <div className="flex flex-col gap-3">
            <div data-figma={`${figmaName}/error`} className="flex items-start gap-3">
              <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="flex flex-col gap-1">
                <p className="text-title-sm text-foreground">{error?.title ?? shell.errorTitle}</p>
                <p className="text-body-sm text-foreground">{error?.body ?? shell.errorBody}</p>
              </div>
            </div>
            {errorChildren}
          </div>
        )
      case "empty":
        return (
          <div data-figma={`${figmaName}/empty`} className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-muted">
              <Inbox aria-hidden className="size-5 text-muted-foreground" />
            </span>
            {empty ? (
              <div className="flex max-w-sm flex-col gap-1">
                <p className="text-title-sm text-foreground">{empty.title}</p>
                {empty.body ? <p className="text-body-sm text-muted-foreground">{empty.body}</p> : null}
              </div>
            ) : null}
          </div>
        )
      case "done": {
        const Icon = SummaryIcon ?? CircleCheck
        const labels = detailsLabels ?? { show: shell.showDetails, hide: shell.hideDetails }
        return (
          <div className="flex flex-col gap-3">
            {summary ? (
              <div data-figma={`${figmaName}/summary`} className="flex items-center gap-2">
                <Icon aria-hidden className={tw("size-4 shrink-0", SummaryIcon ? "text-muted-foreground" : "text-success")} />
                <p className="flex-1 text-body-sm text-foreground">{summary}</p>
                {summaryAction}
              </div>
            ) : null}
            {children ? (
              <>
                <DisclosureTrigger
                  open={detailsOpen}
                  onOpenChange={toggleDetails}
                  controls={detailsId}
                  data-figma={`${figmaName}/details-toggle`}
                  className={tw("w-fit rounded-md text-muted-foreground hover:text-foreground", density === "touch" && TOUCH.control)}
                >
                  <span className="text-caption">{detailsOpen ? labels.hide : labels.show}</span>
                </DisclosureTrigger>
                <div id={detailsId} ref={detailsRef} tabIndex={-1} hidden={!detailsOpen} className="outline-none">
                  {detailsOpen ? children : null}
                </div>
              </>
            ) : null}
          </div>
        )
      }
      default:
        return children
    }
  }

  return (
    <Card
      size={size}
      role="article"
      aria-labelledby={titleId}
      aria-describedby={footnote ? footnoteId : undefined}
      aria-busy={streaming || undefined}
      data-slot="agentic-card"
      data-state={status}
      data-testid={`agentic-card-${id}`}
      data-figma={`${figmaName}/root`}
      className="@container/card"
    >
      <CardHeader data-figma={`${figmaName}/header`}>
        <div className="flex flex-wrap items-center gap-2">
          {status === "needs_you" ? (
            <Badge variant="outline" data-figma={`${figmaName}/badge`}>
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              {shell.needsYou}
            </Badge>
          ) : null}
          {MetaIcon ? <MetaIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
          <span data-figma={`${figmaName}/meta`} className="text-caption text-muted-foreground">
            {streaming ? (streamingLabel ?? shell.working) : meta}
          </span>
        </div>
        <CardTitle>
          <Heading
            id={titleId}
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            data-figma={`${figmaName}/title`}
            className="text-title-md text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {title}
          </Heading>
        </CardTitle>
      </CardHeader>
      <CardContent data-figma={`${figmaName}/body`} className="flex flex-col gap-3">
        {renderBody()}
        {footnote ? (
          <p id={footnoteId} data-figma={`${figmaName}/footnote`} className="flex items-start gap-1.5 text-caption text-muted-foreground">
            {footnote.icon ? <footnote.icon aria-hidden className="mt-px size-3.5 shrink-0" /> : null}
            <span>{footnote.text}</span>
          </p>
        ) : null}
      </CardContent>
      {ctas.length > 0 ? (
        <CardFooter data-figma={`${figmaName}/footer`} className="flex-col items-stretch gap-2">
          {reason ? (
            <span id={reasonId} data-figma={`${figmaName}/reason`} className="text-caption text-muted-foreground @md/card:text-right">
              {reason}
            </span>
          ) : null}
          <div className="flex flex-col-reverse gap-2 @md/card:flex-row @md/card:justify-end">
            {footerOrder.map((cta) => (
              <CtaButton
                key={cta.kind}
                cta={cta}
                figmaName={figmaName}
                reasonId={cta.disabled && cta.disabledReason ? reasonId : undefined}
                touch={density === "touch"}
                reduced={reduced}
              />
            ))}
          </div>
        </CardFooter>
      ) : null}
    </Card>
  )
}

function CtaButton({
  cta,
  figmaName,
  reasonId,
  touch,
  reduced,
}: {
  cta: ResolvedCta
  figmaName: string
  reasonId?: string
  touch: boolean
  reduced: boolean
}): React.JSX.Element {
  const Icon = cta.icon
  const inactive = Boolean(cta.disabled || cta.busy)
  return (
    <Button
      variant={cta.variant}
      data-cta={cta.kind}
      data-figma={`${figmaName}/${cta.kind}`}
      disabled={inactive}
      focusableWhenDisabled
      aria-describedby={reasonId}
      aria-busy={cta.busy || undefined}
      onClick={inactive ? undefined : cta.onClick}
      className={tw("aria-disabled:opacity-50 w-full @md/card:w-auto", touch ? TOUCH.control : "h-11 @md/card:h-8")}
    >
      {cta.busy ? (
        <LoaderCircle aria-hidden data-icon="inline-start" className={tw(!reduced && "animate-spin", "in-data-reduced-motion:animate-none")} />
      ) : Icon ? (
        <Icon aria-hidden data-icon="inline-start" />
      ) : null}
      {cta.busy ? (cta.busyLabel ?? cta.label) : cta.label}
    </Button>
  )
}
