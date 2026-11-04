"use client"

import { useId } from "react"
import { ArrowUpRight, PanelRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Transcript } from "../primitives/transcript"
import { REDUCED_POPUP, TOUCH, tw } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { TranscriptEntry } from "../types"

export type FlyoutPanelProps = {
  status: string
  tip?: string
  context: { label: string; value: string } | null
  entries: TranscriptEntry[]
  composer: React.ReactNode
  assistantAvatar: React.ReactNode
  onFull: () => void
  onHandoff: () => void
  onNewChat: () => void
  onClose: () => void
  onOpenActivity: () => void
  onOpenOverview?: () => void
  handoffDisabled: boolean
  density: "touch" | "pointer"
}

export type FlyoutProps = FlyoutPanelProps & {
  open: boolean
  onOpenChange: (open: boolean, details?: { reason: string; cancel: () => void }) => void
  trigger: React.ReactElement
  layout: "popover" | "sheet"
}

export function FlyoutPanel({
  status,
  tip,
  context,
  entries,
  composer,
  assistantAvatar,
  onFull,
  onHandoff,
  onNewChat,
  onClose,
  onOpenActivity,
  onOpenOverview,
  handoffDisabled,
  density,
}: FlyoutPanelProps): React.JSX.Element {
  const { copy, assistantName } = usePrototype()
  const f = copy.flyout
  const handoffReasonId = useId()

  return (
    <div
      data-slot="agentic-flyout-panel"
      data-state={handoffDisabled ? "no-item" : "ready"}
      data-figma="Flyout/panel"
      className="flex w-full min-w-0 max-w-90 flex-col gap-4 overflow-hidden p-4 text-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-title-sm text-foreground">{f.title}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={f.close}
          onClick={onClose}
          className={density === "touch" ? TOUCH.icon : undefined}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenActivity}
        className="w-full justify-between px-3"
      >
        <span className="truncate text-caption text-muted-foreground">{status}</span>
        <span className="text-caption font-medium text-foreground">{f.activity}</span>
      </Button>

      {onOpenOverview ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onOpenOverview}
          className="w-fit px-1.5 text-caption text-muted-foreground"
        >
          <PanelRight className="size-3.5" aria-hidden />
          {f.exits.overviewTitle}
        </Button>
      ) : tip ? (
        <p className="px-1 text-caption text-muted-foreground">{tip}</p>
      ) : null}

      {context ? (
        <p className="text-caption text-muted-foreground">{context.value}</p>
      ) : null}

      <div className="rounded-xl border border-border bg-background p-2">
        <Transcript
          entries={entries}
          assistantName={assistantName}
          assistantAvatar={assistantAvatar}
          renderAttachment={() => null}
          density="mini"
          touch={density === "touch"}
        />
      </div>

      {composer}

      <div role="group" aria-label={f.title} className="flex flex-col gap-1">
        <Button
          type="button"
          onClick={onFull}
          className="h-auto w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="flex flex-col items-start">
            <span className="text-body-sm font-medium">{f.exits.fullTitle}</span>
            <span className="text-caption opacity-80">{f.exits.fullSub}</span>
          </span>
          <ArrowUpRight className="size-4 shrink-0" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={handoffDisabled}
          focusableWhenDisabled
          aria-describedby={handoffDisabled ? handoffReasonId : undefined}
          onClick={onHandoff}
          className="h-auto w-full items-center justify-between px-3 py-2 text-left aria-disabled:opacity-50"
        >
          <span className="flex flex-col items-start">
            <span className="text-body-sm font-medium text-foreground">{f.exits.handoffTitle}</span>
            <span id={handoffReasonId} className="text-caption text-muted-foreground">
              {f.exits.handoffSub}
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={onNewChat}
          className="h-auto w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="flex flex-col items-start">
            <span className="text-body-sm font-medium text-foreground">{f.exits.newTitle}</span>
            <span className="text-caption text-muted-foreground">{f.exits.newSub}</span>
          </span>
        </Button>
      </div>
    </div>
  )
}

export function Flyout({
  open,
  onOpenChange,
  trigger,
  layout,
  ...panelProps
}: FlyoutProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const composerFocus = () => document.querySelector<HTMLElement>("[data-slot=agentic-flyout-panel] textarea")

  if (layout === "sheet") {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            initialFocus={composerFocus}
            className={tw("max-h-9/10 overflow-y-auto rounded-t-2xl p-0", reduced && REDUCED_POPUP)}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>
                <span className="text-title-md">{copy.flyout.title}</span>
              </SheetTitle>
            </SheetHeader>
            <FlyoutPanel {...panelProps} />
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal="trap-focus">
      <PopoverTrigger render={trigger} />
      {open ? (
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          initialFocus={composerFocus}
          className={tw("w-90 max-w-90 min-w-0 overflow-hidden p-0", reduced && REDUCED_POPUP)}
        >
          <FlyoutPanel {...panelProps} />
        </PopoverContent>
      ) : null}
    </Popover>
  )
}
