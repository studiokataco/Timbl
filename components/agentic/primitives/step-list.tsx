"use client"

import { useEffect, useRef } from "react"
import { useAnimate } from "framer-motion"
import { Circle, CircleAlert, CircleCheck, CircleDot, CircleSlash, LoaderCircle } from "lucide-react"
import { DUR, EASE_OUT, tw } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { RunStep, RunStepState } from "../types"

type StepListProps = { steps: RunStep[]; density?: "full" | "compact" }

function durationSeconds(step: RunStep): string | null {
  if (step.startedAt === undefined || step.finishedAt === undefined) return null
  return `${((step.finishedAt - step.startedAt) / 1000).toFixed(1)} s`
}

export function StepList({ steps, density = "full" }: StepListProps): React.JSX.Element {
  const { copy } = usePrototype()
  const compact = density === "compact"
  return (
    <ol
      aria-label={copy.plan.stepsLabel}
      data-slot="agentic-step-list"
      data-state={density}
      data-figma="StepList/root"
      className={tw("flex flex-col", compact ? "gap-1.5" : "gap-2.5")}
    >
      {steps.map((step) => (
        <li key={step.id} data-state={step.state} data-figma="StepList/step" className="flex flex-col gap-0.5">
          <div className="flex items-start gap-2.5">
            <StepIcon state={step.state} />
            <StepLabel text={step.state === "done" ? step.doneLabel : step.label} muted={step.state === "pending" || step.state === "cancelled"} />
            <span className="sr-only">{copy.plan.state[step.state]}</span>
            {!compact && durationSeconds(step) ? (
              <span className="ms-auto shrink-0 text-caption text-muted-foreground tabular-nums">{durationSeconds(step)}</span>
            ) : null}
          </div>
          {step.state === "failed" && step.error ? <p className="ps-6.5 text-body-sm text-foreground">{step.error}</p> : null}
        </li>
      ))}
    </ol>
  )
}

function StepIcon({ state }: { state: RunStepState }): React.JSX.Element {
  const { reduced } = useAgenticMotion()
  const base = "mt-0.5 size-4 shrink-0"
  switch (state) {
    case "running":
      return reduced ? (
        <CircleDot aria-hidden className={tw(base, "text-brand-accent")} />
      ) : (
        <LoaderCircle aria-hidden className={tw(base, "animate-spin text-brand-accent in-data-reduced-motion:animate-none")} />
      )
    case "done":
      return <CircleCheck aria-hidden className={tw(base, "text-success")} />
    case "failed":
      return <CircleAlert aria-hidden className={tw(base, "text-destructive")} />
    case "cancelled":
      return <CircleSlash aria-hidden className={tw(base, "text-muted-foreground")} />
    default:
      return <Circle aria-hidden className={tw(base, "text-muted-foreground")} />
  }
}

function StepLabel({ text, muted }: { text: string; muted: boolean }): React.JSX.Element {
  const { reduced } = useAgenticMotion()
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  const previous = useRef(text)

  useEffect(() => {
    if (previous.current === text) return
    previous.current = text
    if (reduced || !scope.current) return
    animate(scope.current, { opacity: [0, 1] }, { duration: DUR.appear, ease: EASE_OUT })
  }, [text, reduced, animate, scope])

  return (
    <span ref={scope} className={tw("min-w-0 flex-1 text-body-sm", muted ? "text-muted-foreground" : "text-foreground")}>
      {text}
    </span>
  )
}
