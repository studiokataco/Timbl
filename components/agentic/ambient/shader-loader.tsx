"use client"

import { useAgenticMotion } from "../prototype-context"
import { tw } from "../lib"

export type ShaderLoaderProps = { running: boolean; fallback?: boolean }

export function ShaderLoader({ running, fallback = false }: ShaderLoaderProps): React.JSX.Element {
  const { reduced } = useAgenticMotion()
  const live = running && !reduced
  return (
    <span
      aria-hidden="true"
      data-slot="agentic-shader-loader"
      data-state={live ? (fallback ? "fallback" : "running") : "static"}
      data-mesh="tide"
      data-figma="ShaderLoader/root"
      className={tw("timbl-mesh inline-block size-4 shrink-0 rounded-full ring-1 ring-foreground/10", live && "timbl-mesh-live")}
    />
  )
}
