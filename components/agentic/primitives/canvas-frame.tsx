"use client"

import { useId } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Maximize2, Minimize2, PanelRightClose, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DUR, EASE_IN, EASE_OUT, REDUCED_POPUP, TOUCH, tw } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { CanvasVisibility } from "../types"

type CanvasFrameProps = {
  meta: string
  visibility: CanvasVisibility
  onVisibilityChange: (v: CanvasVisibility) => void
  layout: "column" | "sheet"
  headerExtra?: React.ReactNode
  working?: React.ReactNode
  children: React.ReactNode
  cardKey: string
}

type CanvasEmptyProps = { onStart: () => void }

export function CanvasFrame({
  meta,
  visibility,
  onVisibilityChange,
  layout,
  headerExtra,
  working,
  children,
  cardKey,
}: CanvasFrameProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const titleId = useId()
  const expanded = visibility === "expanded"
  const sheet = layout === "sheet"
  const t = copy.timbl

  const enter = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: DUR.fade } }, exit: { opacity: 0, transition: { duration: DUR.fade } } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { duration: DUR.enter, ease: EASE_OUT } },
        exit: { opacity: 0, y: -6, transition: { duration: DUR.exit, ease: EASE_IN } },
      }

  return (
    <section
      aria-labelledby={titleId}
      hidden={visibility === "hidden"}
      data-slot="agentic-canvas-frame"
      data-state={visibility}
      data-layout={layout}
      data-figma="CanvasFrame/root"
      className="flex min-h-0 flex-1 flex-col bg-background"
    >
      <div
        data-figma="CanvasFrame/header"
        className={tw("flex shrink-0 items-center gap-2 border-b border-border", sheet ? "min-h-14 px-4" : "h-14 px-6")}
      >
        {sheet ? headerExtra : null}
        <span id={titleId} data-figma="CanvasFrame/title" className="shrink-0 text-title-sm text-foreground">
          {copy.canvas.title}
        </span>
        <span data-figma="CanvasFrame/meta" className="min-w-0 truncate text-caption text-muted-foreground">
          {meta}
        </span>
        {working ? <div className="flex min-w-0 items-center">{working}</div> : null}
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <HeaderButton
            icon={expanded ? Minimize2 : Maximize2}
            label={t.expandCanvas}
            tooltip={expanded ? t.collapseCanvas : t.expandCanvas}
            pressed={expanded}
            touch={sheet}
            reduced={reduced}
            figma="CanvasFrame/expand"
            onClick={() => onVisibilityChange(expanded ? "shown" : "expanded")}
          />
          {sheet ? null : (
            <HeaderButton
              icon={PanelRightClose}
              label={t.hideCanvas}
              tooltip={t.hideCanvas}
              touch={false}
              reduced={reduced}
              figma="CanvasFrame/hide"
              onClick={() => onVisibilityChange("hidden")}
            />
          )}
        </div>
      </div>
      <div
        data-figma="CanvasFrame/body"
        className={sheet ? "min-h-0 flex-1 overflow-y-auto bg-background" : "min-h-0 flex-1 overflow-y-auto bg-surface-soft/60 dark:bg-surface-card/25"}
      >
        <div className={tw("mx-auto w-full max-w-180", sheet ? "px-4 py-4" : "px-6 py-8")}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={cardKey} {...enter}>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

function HeaderButton({
  icon: Icon,
  label,
  tooltip,
  pressed,
  touch,
  reduced,
  figma,
  onClick,
}: {
  icon: LucideIcon
  label: string
  tooltip: string
  pressed?: boolean
  touch: boolean
  reduced: boolean
  figma: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={pressed}
            data-figma={figma}
            className={touch ? TOUCH.icon : undefined}
            onClick={onClick}
          />
        }
      >
        <Icon aria-hidden />
      </TooltipTrigger>
      <TooltipContent className={reduced ? REDUCED_POPUP : undefined}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function CanvasEmpty({ onStart }: CanvasEmptyProps): React.JSX.Element {
  const { copy } = usePrototype()
  return (
    <div
      data-slot="agentic-canvas-empty"
      data-state="empty"
      data-figma="CanvasEmpty/root"
      className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6 text-left"
    >
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <p data-figma="CanvasEmpty/title" className="text-title-md text-foreground">
          {copy.canvas.emptyTitle}
        </p>
        <p data-figma="CanvasEmpty/body" className="max-w-md text-body-sm text-muted-foreground">
          {copy.canvas.emptyBody}
        </p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-surface-soft/50 py-3">
        <div className="flex flex-col gap-0.5 px-3">
          <span className="text-caption text-muted-foreground">{copy.iface.rail.stats.scheduled}</span>
          <span className="text-title-sm text-foreground tabular-nums">2</span>
        </div>
        <div className="flex flex-col gap-0.5 px-3">
          <span className="text-caption text-muted-foreground">{copy.iface.rail.stats.review}</span>
          <span className="text-title-sm text-foreground tabular-nums">3</span>
        </div>
        <div className="flex flex-col gap-0.5 px-3">
          <span className="text-caption text-muted-foreground">{copy.iface.rail.stats.slots}</span>
          <span className="text-title-sm text-foreground tabular-nums">1</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-caption text-muted-foreground">{copy.iface.rail.footer}</span>
        <Button variant="outline" data-figma="CanvasEmpty/start" onClick={onStart}>
          {copy.canvas.start}
        </Button>
      </div>
    </div>
  )
}
