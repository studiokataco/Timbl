"use client"

import { useAgenticMotion, usePrototype } from "../prototype-context"
import { ShaderLoader } from "./shader-loader"
import type { RunStep } from "../types"

export type WorkingStatementProps = {
  step: RunStep | null
  index: number
  total: number
  loader: "webgl" | "fallback"
}

export function WorkingStatement({ step, index, total, loader }: WorkingStatementProps): React.JSX.Element | null {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  if (!step || step.state !== "running") return null

  const label = reduced ? copy.ambient.reduced(index, total) : copy.ambient.statement(step.label)

  return (
    <div
      data-slot="agentic-working-statement"
      data-state={reduced ? "reduced" : "running"}
      data-figma="WorkingStatement/root"
      className="inline-flex items-center gap-2"
    >
      <ShaderLoader running={!reduced} fallback={loader === "fallback" || reduced} />
      <span data-figma="WorkingStatement/text" className="text-caption text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
