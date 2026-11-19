"use client"

import { CircleSlash } from "lucide-react"
import { STEP_MS } from "../lib"
import { usePrototype } from "../prototype-context"
import type { Run } from "../types"
import { AgenticCard } from "./agentic-card"
import { StepList } from "./step-list"

type PlanCardProps = { run: Run; onStart: () => void; onRevise: () => void; onStop: () => void; onRetry: () => void }

export function PlanCard({ run, onStart, onRevise, onStop, onRetry }: PlanCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const plan = copy.plan
  const common = { id: `plan-${run.id}`, meta: plan.title, title: run.title, headingLevel: 3 as const, figmaName: "PlanCard" }
  const steps = <StepList steps={run.steps} />

  function render(): React.JSX.Element {
    switch (run.status) {
      case "proposed":
        return (
          <AgenticCard
            {...common}
            primary={{ label: plan.primary, onClick: onStart }}
            secondary={{ label: plan.secondary, onClick: onRevise }}
          >
            {steps}
            <p className="text-caption text-muted-foreground">{plan.estimate(Math.round((run.steps.length * STEP_MS.normal) / 1000))}</p>
          </AgenticCard>
        )
      case "running":
      case "needs_you":
        return (
          <AgenticCard {...common} secondary={{ label: plan.stop, onClick: onStop }}>
            {steps}
          </AgenticCard>
        )
      case "done":
        return (
          <AgenticCard
            {...common}
            status="done"
            summary={plan.done(run.steps.length)}
            detailsKey={`run:${run.id}:steps`}
            detailsLabels={{ show: plan.showSteps, hide: plan.hideSteps }}
          >
            {steps}
          </AgenticCard>
        )
      case "error": {
        const failed = run.steps.find((step) => step.state === "failed")
        return (
          <AgenticCard
            {...common}
            status="error"
            error={{
              title: copy.cards.shell.errorTitle,
              body: failed?.error ?? copy.cards.shell.errorBody,
              onRetry,
              onEdit: onRevise,
            }}
            errorChildren={<StepList steps={run.steps.map((step) => (step.state === "failed" ? { ...step, error: undefined } : step))} />}
          />
        )
      }
      case "cancelled":
        return (
          <AgenticCard {...common}>
            <p data-figma="PlanCard/summary" className="flex items-center gap-2 text-body-sm text-foreground">
              <CircleSlash aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              {plan.cancelled}
            </p>
            {steps}
          </AgenticCard>
        )
    }
  }

  return (
    <div data-slot="agentic-plan-card" data-state={run.status} data-figma="PlanCard/frame" className="w-full">
      {render()}
    </div>
  )
}
